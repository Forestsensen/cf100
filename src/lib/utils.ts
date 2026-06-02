/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import he from 'he';

// ============ 设备检测工具函数 ============
const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/i.test(userAgent) && !(window as any).MSStream;
export const isIOS13Plus = isIOS || (
  typeof window !== 'undefined' &&
  userAgent.includes('Macintosh') &&
  typeof navigator !== 'undefined' &&
  navigator.maxTouchPoints >= 1
);
export const isIPad = typeof window !== 'undefined' && (/iPad/i.test(userAgent) || (
  userAgent.includes('Macintosh') &&
  typeof navigator !== 'undefined' &&
  navigator.maxTouchPoints > 2
));
export const isAndroid = /Android/i.test(userAgent);
export const isMobile = isIOS13Plus || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
export const isTablet = isIPad || (isAndroid && !/Mobile/i.test(userAgent)) ||
  (typeof window !== 'undefined' && typeof screen !== 'undefined' && screen.width >= 768);
export const isSafari = /^(?:(?!chrome|android).)*safari/i.test(userAgent) && !isAndroid;

export type DevicePerformance = 'low' | 'medium' | 'high';
export function getDevicePerformanceLevel(): DevicePerformance {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile) return cores >= 6 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : cores >= 4 ? 'medium' : 'low';
}
export const devicePerformance: DevicePerformance = typeof window !== 'undefined' ? getDevicePerformanceLevel() : 'medium';

function getDoubanImageProxyConfig(): {
  proxyType:
  | 'server'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'custom';
  proxyUrl: string;
} {
  let doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  // 兼容历史数据：直连和豆瓣官方精品 CDN 统一使用服务器代理
  if (doubanImageProxyType === 'direct' || doubanImageProxyType === 'img3') {
    doubanImageProxyType = 'server';
  }
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    default:
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * 纯 fetch 方案：通过 CORSAPI 代理全程转发，避免 hls.js 分片跨域问题
 * 1. 通过代理获取 m3u8 文本 → 解析分辨率标签 + 分片地址
 * 2. 下载 3 个分片测速（trim mean）
 * 3. HEAD 请求测 ping
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}>
 */
export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  const CORSAPI_PROXY = 'https://tvdy.102624.xyz';
  const proxy = (url: string) => `${CORSAPI_PROXY}/?url=${encodeURIComponent(url)}`;

  // 解析 m3u8 URL 的基础路径（用于拼接相对路径分片）
  const m3u8Base = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    console.log('[测速] fetch方案开始, url:', m3u8Url);

    // ---- 1. ping 测量 ----
    const pingStart = performance.now();
    let pingTime = 0;
    fetch(proxy(m3u8Url), { method: 'HEAD', signal: controller.signal })
      .then(() => { pingTime = performance.now() - pingStart; })
      .catch(() => { pingTime = performance.now() - pingStart; });

    // ---- 2. 下载 m3u8 文本 ----
    const m3u8Resp = await fetch(proxy(m3u8Url), { signal: controller.signal });
    if (!m3u8Resp.ok) {
      throw new Error(`m3u8请求失败: ${m3u8Resp.status}`);
    }
    const m3u8Text = await m3u8Resp.text();

    // ---- 3. 解析分辨率 + 分片地址 ----
    let quality = '未知';
    // 解析分辨率标签，优先级: RESOLUTION > BANDWIDTH 标签名 > 默认
    const resMatch = m3u8Text.match(/RESOLUTION=(\d+)x(\d+)/);
    if (resMatch) {
      const w = parseInt(resMatch[1]);
      quality = w >= 3840 ? '4K' : w >= 2560 ? '2K' : w >= 1920 ? '1080p' : w >= 1280 ? '720p' : w >= 854 ? '480p' : 'SD';
    }

    // 收集分片地址（.ts 或纯URL行）
    const segmentUrls: string[] = [];
    for (const line of m3u8Text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // 如果是多码率 master playlist，跳过子 m3u8 路径
      if (trimmed.endsWith('.m3u8') || trimmed.includes('.m3u8?')) continue;
      // 拼接绝对路径
      const fullUrl = trimmed.startsWith('http') ? trimmed : m3u8Base + trimmed;
      segmentUrls.push(fullUrl);
    }

    // 如果没有分片但有子 m3u8（master playlist），取第一个子 m3u8 的分片
    if (segmentUrls.length === 0) {
      const subM3u8Match = m3u8Text.match(/^(https?:\/\/[^\s]+\.m3u8[^\s]*)/m);
      if (subM3u8Match) {
        const subUrl = subM3u8Match[1].startsWith('http') ? subM3u8Match[1] : m3u8Base + subM3u8Match[1];
        console.log('[测速] 进入子m3u8:', subUrl);
        const subResp = await fetch(proxy(subUrl), { signal: controller.signal });
        if (subResp.ok) {
          const subText = await subResp.text();
          // 再次尝试解析分辨率
          if (quality === '未知') {
            const subRes = subText.match(/RESOLUTION=(\d+)x(\d+)/);
            if (subRes) {
              const w = parseInt(subRes[1]);
              quality = w >= 3840 ? '4K' : w >= 2560 ? '2K' : w >= 1920 ? '1080p' : w >= 1280 ? '720p' : w >= 854 ? '480p' : 'SD';
            }
          }
          const subBase = subUrl.substring(0, subUrl.lastIndexOf('/') + 1);
          for (const line of subText.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const fullUrl = trimmed.startsWith('http') ? trimmed : subBase + trimmed;
            segmentUrls.push(fullUrl);
          }
        }
      }
    }

    // ---- 4. 下载分片测速 ----
    let loadSpeed = '未知';
    const MAX_SEGS = Math.min(3, segmentUrls.length);

    if (MAX_SEGS > 0) {
      const speeds: number[] = [];
      for (let i = 0; i < MAX_SEGS; i++) {
        try {
          const start = performance.now();
          const segResp = await fetch(proxy(segmentUrls[i]), { signal: controller.signal });
          if (!segResp.ok) continue;
          // 读取 body 测真实下载速度
          const buf = await segResp.arrayBuffer();
          const elapsed = performance.now() - start;
          if (elapsed > 0 && buf.byteLength > 0) {
            speeds.push(buf.byteLength / 1024 / (elapsed / 1000)); // KB/s
          }
        } catch {
          // 单个分片失败不影响整体
        }
      }

      if (speeds.length > 0) {
        // trim mean: 去掉最高最低
        speeds.sort((a, b) => a - b);
        const avg = speeds.length > 2
          ? speeds.slice(1, -1).reduce((a, b) => a + b, 0) / (speeds.length - 2)
          : speeds.reduce((a, b) => a + b, 0) / speeds.length;
        loadSpeed = avg >= 1024 ? `${(avg / 1024).toFixed(1)} MB/s` : `${avg.toFixed(1)} KB/s`;
      }
    }

    clearTimeout(timeout);
    console.log('[测速] 完成:', quality, loadSpeed, Math.round(pingTime) + 'ms');
    return { quality, loadSpeed, pingTime: Math.round(pingTime) };

  } catch (error) {
    clearTimeout(timeout);
    console.error('[测速] 失败:', error instanceof Error ? error.message : error);
    throw new Error(`测速失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解码 HTML 实体
  return he.decode(cleanedText);
}
