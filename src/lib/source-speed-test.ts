/**
 * 视频源流测速模块
 * 移植自 Selene M3U8Service，适配 cf100 Edge Runtime + 客户端环境
 *
 * 功能：
 * 1. 解析 m3u8 主播放列表获取分辨率
 * 2. HEAD 请求测量网络延迟
 * 3. 并发下载分片测量下载速度
 * 4. 加权评分选择最佳源
 *
 * CF 限制考量：
 * - 纯客户端执行，不占用 Pages Functions 配额
 * - 通过 CORSAPI Worker 代理解决跨域
 * - 每源 5 个请求（1 m3u8 + 1 HEAD + 3 分片），10 源 = 50 请求
 */

// CORSAPI Worker 代理地址
const CORSAPI_PROXY = 'https://tvdy.102624.xyz';

// 通过代理请求
async function proxyFetch(url: string, options?: RequestInit): Promise<Response> {
  const proxyUrl = `${CORSAPI_PROXY}/?url=${encodeURIComponent(url)}`;
  return fetch(proxyUrl, options);
}

// ============ 分辨率解析 ============

export interface Resolution {
  width: number;
  height: number;
}

/**
 * 解析 m3u8 主播放列表，提取最高分辨率
 */
export async function parseM3u8Resolution(m3u8Url: string): Promise<Resolution> {
  try {
    const response = await proxyFetch(m3u8Url);
    if (!response.ok) return { width: 0, height: 0 };

    const content = await response.text();
    const lines = content.split('\n').map(l => l.trim());

    let bestResolution: Resolution = { width: 0, height: 0 };

    for (const line of lines) {
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const params: Record<string, string> = {};
        const parts = line.substring('#EXT-X-STREAM-INF:'.length).split(',');

        for (const part of parts) {
          const [key, ...valueParts] = part.split('=');
          if (key && valueParts.length > 0) {
            params[key.trim()] = valueParts.join('=').trim();
          }
        }

        if (params['RESOLUTION']) {
          const dimensions = params['RESOLUTION'].split('x');
          if (dimensions.length === 2) {
            const width = parseInt(dimensions[0], 10) || 0;
            const height = parseInt(dimensions[1], 10) || 0;
            // 取最高分辨率
            if (height > bestResolution.height) {
              bestResolution = { width, height };
            }
          }
        }
      }
    }

    return bestResolution;
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * 解析 m3u8 媒体播放列表，提取分片 URL
 */
export async function parseM3u8Segments(m3u8Url: string): Promise<string[]> {
  try {
    const response = await proxyFetch(m3u8Url);
    if (!response.ok) return [];

    const content = await response.text();
    const lines = content.split('\n').map(l => l.trim());
    const segments: string[] = [];

    // 构建基础 URL
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        // 处理相对路径和绝对路径
        if (line.startsWith('http')) {
          segments.push(line);
        } else {
          segments.push(baseUrl + line);
        }
      }
    }

    return segments;
  } catch {
    return [];
  }
}

// ============ 延迟测量 ============

/**
 * 测量网络延迟（HEAD 请求）
 */
export async function measureLatency(url: string): Promise<number> {
  try {
    const start = performance.now();
    await proxyFetch(url, { method: 'HEAD', mode: 'no-cors' });
    return Math.round(performance.now() - start);
  } catch {
    return -1;
  }
}

// ============ 下载速度测量 ============

/**
 * 测量下载速度（并发下载多个分片）
 * @param segmentUrls 分片 URL 列表
 * @param maxSegments 最多下载几个分片（默认 3）
 * @returns 下载速度 (KB/s)
 */
export async function measureDownloadSpeed(
  segmentUrls: string[],
  maxSegments = 3
): Promise<number> {
  const segmentsToTest = segmentUrls.slice(0, maxSegments);
  if (segmentsToTest.length === 0) return 0;

  try {
    const start = performance.now();

    // 并发下载
    const results = await Promise.allSettled(
      segmentsToTest.map(url =>
        proxyFetch(url).then(async res => {
          if (!res.ok) return 0;
          const buffer = await res.arrayBuffer();
          return buffer.byteLength;
        })
      )
    );

    const elapsed = (performance.now() - start) / 1000; // 秒
    const totalBytes = results.reduce((sum, r) => {
      return sum + (r.status === 'fulfilled' ? r.value : 0);
    }, 0);

    if (elapsed <= 0 || totalBytes === 0) return 0;
    return totalBytes / 1024 / elapsed; // KB/s
  } catch {
    return 0;
  }
}

// ============ 分辨率等级转换 ============

export type QualityLevel = '4K' | '2K' | '1080p' | '720p' | '480p' | 'SD' | '未知';

export function resolutionToQuality(resolution: Resolution): QualityLevel {
  const { height } = resolution;
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height > 0) return 'SD';
  return '未知';
}

// ============ 评分算法 ============

export interface SourceScore {
  resolution: Resolution;
  quality: QualityLevel;
  latency: number;      // ms
  speed: number;        // KB/s
  score: number;        // 0-100 综合评分
}

/**
 * 计算单个源的综合评分
 * 权重：分辨率 40% + 速度 40% + 延迟 20%
 */
export function calculateScore(
  resolution: Resolution,
  speed: number,
  latency: number,
  maxSpeed: number,
  minPing: number,
  maxPing: number
): number {
  // 分辨率评分 (0-100)
  const qualityScores: Record<string, number> = {
    '4K': 100,
    '2K': 85,
    '1080p': 70,
    '720p': 50,
    '480p': 30,
    'SD': 15,
    '未知': 0,
  };
  const quality = resolutionToQuality(resolution);
  const qualityScore = qualityScores[quality] || 0;

  // 速度评分 (0-100) - 基于最快速度线性映射
  const speedScore = maxSpeed > 0 ? Math.min((speed / maxSpeed) * 100, 100) : 0;

  // 延迟评分 (0-100) - 基于延迟范围线性映射
  let pingScore = 0;
  if (latency > 0 && maxPing > minPing) {
    pingScore = Math.max(0, ((maxPing - latency) / (maxPing - minPing)) * 100);
  } else if (latency > 0 && maxPing === minPing) {
    pingScore = 100;
  }

  // 加权：分辨率 40% + 速度 40% + 延迟 20%
  return qualityScore * 0.4 + speedScore * 0.4 + pingScore * 0.2;
}

// ============ 完整测速流程 ============

export interface SourceTestResult {
  sourceKey: string;
  sourceName: string;
  m3u8Url: string;
  resolution: Resolution;
  quality: QualityLevel;
  latency: number;
  speed: number;
  score: number;
  error?: string;
}

/**
 * 对单个源进行完整测速
 * @param sourceApi 源站 API 地址
 * @param sourceKey 源标识
 * @param sourceName 源名称
 * @param searchKeyword 搜索关键词（用于获取视频 m3u8 URL）
 */
export async function testSingleSource(
  sourceApi: string,
  sourceKey: string,
  sourceName: string,
  searchKeyword = '电影'
): Promise<SourceTestResult> {
  const emptyResult: SourceTestResult = {
    sourceKey,
    sourceName,
    m3u8Url: '',
    resolution: { width: 0, height: 0 },
    quality: '未知',
    latency: -1,
    speed: 0,
    score: 0,
  };

  try {
    // 1. 搜索获取视频列表
    // 处理代理 URL：如果源 API 包含 ?url=，提取实际 API 地址
    let actualApi = sourceApi;
    const proxyMatch = sourceApi.match(/[?&]url=([^&]+)/);
    if (proxyMatch) {
      actualApi = decodeURIComponent(proxyMatch[1]);
    }
    
    // 源 API URL 已经包含完整路径，直接加查询参数
    const separator = actualApi.includes('?') ? '&' : '?';
    const searchUrl = `${actualApi}${separator}ac=videolist&wd=${encodeURIComponent(searchKeyword)}`;
    const searchRes = await proxyFetch(searchUrl);
    if (!searchRes.ok) {
      return { ...emptyResult, error: `搜索失败: ${searchRes.status}` };
    }

    const searchData = await searchRes.json();
    const videos = searchData?.list || [];
    if (videos.length === 0) {
      return { ...emptyResult, error: '无搜索结果' };
    }

    // 2. 获取第一个视频的 m3u8 URL
    const video = videos[0];
    const playUrl = video.vod_play_url || '';
    const m3u8Match = playUrl.match(/https?:\/\/[^\s$]+\.m3u8[^\s$]*/);
    if (!m3u8Match) {
      return { ...emptyResult, error: '无 m3u8 地址' };
    }

    const m3u8Url = m3u8Match[0];

    // 3. 并发：解析分辨率 + 测延迟 + 获取分片
    const [resolution, segments] = await Promise.all([
      parseM3u8Resolution(m3u8Url),
      parseM3u8Segments(m3u8Url),
    ]);

    // 4. 测延迟（用第一个分片）
    let latency = -1;
    if (segments.length > 0) {
      latency = await measureLatency(segments[0]);
    }

    // 5. 测下载速度（前 3 个分片）
    let speed = 0;
    if (segments.length > 0) {
      speed = await measureDownloadSpeed(segments, 3);
    }

    // 6. 返回结果（评分在批量测试后统一计算）
    return {
      sourceKey,
      sourceName,
      m3u8Url,
      resolution,
      quality: resolutionToQuality(resolution),
      latency,
      speed,
      score: 0, // 后续由 calculateScore 统一计算
    };
  } catch (err) {
    return {
      ...emptyResult,
      error: err instanceof Error ? err.message : '测速失败',
    };
  }
}

/**
 * 批量测速并计算综合评分
 * @param sources 源列表 [{ api, key, name }]
 * @param searchKeyword 搜索关键词
 * @param onProgress 进度回调
 */
export async function testAllSources(
  sources: { api: string; key: string; name: string }[],
  searchKeyword = '电影',
  onProgress?: (result: SourceTestResult, completed: number, total: number) => void
): Promise<SourceTestResult[]> {
  const results: SourceTestResult[] = [];
  const total = sources.length;

  // 逐个测试（避免并发过多）
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const result = await testSingleSource(source.api, source.key, source.name, searchKeyword);
    results.push(result);
    onProgress?.(result, i + 1, total);
  }

  // 计算综合评分
  const validResults = results.filter(r => !r.error);
  if (validResults.length > 0) {
    const maxSpeed = Math.max(...validResults.map(r => r.speed), 1);
    const latencies = validResults.filter(r => r.latency > 0).map(r => r.latency);
    const minPing = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxPing = latencies.length > 0 ? Math.max(...latencies) : 1;

    for (const result of results) {
      if (!result.error) {
        result.score = calculateScore(
          result.resolution,
          result.speed,
          result.latency,
          maxSpeed,
          minPing,
          maxPing
        );
      }
    }
  }

  // 按评分排序
  results.sort((a, b) => b.score - a.score);

  return results;
}
