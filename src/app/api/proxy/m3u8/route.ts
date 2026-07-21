/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import {
  AD_DOMAINS,
  AD_KEYWORDS,
  DEAD_CDN_DOMAINS,
  DIRECT_HOST_KEYWORDS,
} from '@/lib/ad-rules';
import { getConfig } from '@/lib/config';
import { buildUpstreamHeaders, getBaseUrl, resolveUrl } from '@/lib/live';
import { proxyErrorResponse, upstreamErrorStatus } from '@/lib/proxyError';

export const runtime = 'edge';

function isDirectHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return DIRECT_HOST_KEYWORDS.some((k) => h.includes(k));
}

/**
 * 检测一行是否为广告片段 URL（精确域名 + 关键字子串匹配）
 */
function isAdSegmentUrl(line: string): boolean {
  try {
    const url = new URL(line);
    const hostname = url.hostname.toLowerCase();
    const href = url.href.toLowerCase();

    // 精确匹配广告域名
    for (const domain of AD_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }

    // 关键字子串匹配（URL 路径/参数中的广告特征）
    for (const kw of AD_KEYWORDS) {
      if (href.includes(kw)) {
        return true;
      }
    }
  } catch {
    // URL 解析失败，不认为是广告
  }
  return false;
}

/**
 * 检测一行是否为死链/防盗链 CDN 节点（精确匹配，跳过避免播放中断）
 */
function isDeadCdnUrl(line: string): boolean {
  try {
    const url = new URL(line);
    const hostname = url.hostname.toLowerCase();
    for (const domain of DEAD_CDN_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }
  } catch {
    // URL 解析失败，不认为是死链
  }
  return false;
}

/**
 * 检测广告起始标记
 */
function isAdStartMarker(line: string): boolean {
  if (line.startsWith('#EXT-X-CUE-OUT')) return true;
  if (line.startsWith('#EXT-X-SCTE35')) return true;
  if (line.startsWith('#EXT-X-SCTE-OUT')) return true;
  if (
    line.startsWith('#EXT-X-DATERANGE') &&
    (line.includes('CLASS="ad"') ||
      line.includes('CLASS="commercial"') ||
      line.includes('SCTE35-OUT'))
  ) {
    return true;
  }
  return false;
}

/**
 * 检测广告结束标记
 */
function isAdEndMarker(line: string): boolean {
  if (line.startsWith('#EXT-X-CUE-IN')) return true;
  if (line.startsWith('#EXT-X-SCTE-IN')) return true;
  if (line.startsWith('#EXT-X-DATERANGE') && line.includes('SCTE35-IN')) {
    return true;
  }
  return false;
}

/**
 * 过滤 M3U8 中的广告片段
 *
 * 策略（按优先级）：
 *   1) CUE-OUT/IN / SCTE35 广告标记块 → 整块跳过
 *   2) 已知广告域名（AD_DOMAINS 精确匹配）
 *   3) 广告关键字子串匹配（AD_KEYWORDS，URL 路径/参数）
 *   4) 死链 CDN 域名（DEAD_CDN_DOMAINS）
 *   5) Host-divergence：非主用 host 的分片 → 判定为前贴/中插广告
 *   6) 前贴检测：首段时长显著长于平均且段数少 → 可疑前贴
 */
function filterAdsFromM3U8(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inAdBlock = false;
  let removedSegments = 0;

  // ---- 统计主用 CDN（host-divergence 需要）----
  const hostCount: Record<string, number> = {};
  for (const line of lines) {
    const s = line.trim();
    if (s && !s.startsWith('#')) {
      try {
        const h = new URL(s).hostname.toLowerCase();
        if (h) hostCount[h] = (hostCount[h] || 0) + 1;
      } catch {
        /* ignore */
      }
    }
  }
  let mainHost = '';
  let maxCount = 0;
  for (const [h, c] of Object.entries(hostCount)) {
    if (c > maxCount) {
      maxCount = c;
      mainHost = h;
    }
  }

  // ---- 收集所有 EXTINF+URL 段信息（前贴检测需要）----
  interface SegInfo {
    dur: number;
    urlIdx: number;
  }
  const segments: SegInfo[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^#EXT[-X]?INF:/i.test(lines[i].trim())) {
      const m = lines[i].match(/#EXT[-X]?INF:([\d.]+)/i);
      const dur = m ? parseFloat(m[1]) : 0;
      const nxt = lines[i + 1]?.trim() || '';
      if (nxt && !nxt.startsWith('#')) segments.push({ dur, urlIdx: i + 1 });
    }
  }

  // 前贴启发式：段数少 + 首段明显偏长
  const isLikelyPreRoll =
    segments.length >= 2 &&
    segments.length <= 20 &&
    segments[0].dur >= 45 &&
    segments.length > 1 &&
    segments[0].dur > (segments[1].dur || 0) * 2;

  let preRollSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 广告起始标记
    if (isAdStartMarker(trimmed)) {
      inAdBlock = true;
      removedSegments++;
      continue;
    }

    // 广告结束标记
    if (isAdEndMarker(trimmed)) {
      inAdBlock = false;
      continue;
    }

    // 在广告块内，跳过
    if (inAdBlock) continue;

    // 检测独立广告片段 URL 或死链 CDN 节点
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      (isAdSegmentUrl(trimmed) || isDeadCdnUrl(trimmed))
    ) {
      // 跳过前一行的 #EXTINF
      if (
        result.length > 0 &&
        result[result.length - 1].trim().startsWith('#EXTINF')
      ) {
        result.pop();
      }
      removedSegments++;
      continue;
    }

    // Host-divergence：来自非主用 host 的分片 → 广告
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      mainHost &&
      maxCount >= 3 // 至少有 3 个分片才做 divergence（避免单段误判）
    ) {
      try {
        const segHost = new URL(trimmed).hostname.toLowerCase();
        if (segHost && segHost !== mainHost) {
          // 跳过前一行的 #EXTINF
          if (
            result.length > 0 &&
            result[result.length - 1].trim().startsWith('#EXTINF')
          ) {
            result.pop();
          }
          removedSegments++;
          continue;
        }
      } catch {
        /* ignore */
      }
    }

    // 前贴检测（仅对第一段 EXTINF+URL 生效一次）
    if (
      trimmed &&
      /^#EXT[-X]?INF:/i.test(trimmed) &&
      isLikelyPreRoll &&
      !preRollSkipped
    ) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (nextLine && !nextLine.startsWith('#')) {
        // 跳过这对 EXTINF+URL
        preRollSkipped = true;
        removedSegments++;
        i++; // 多跳一行 URL
        continue;
      }
    }

    result.push(line);
  }

  if (removedSegments > 0) {
    console.log(
      `[AdBlock] 已移除 ${removedSegments} 个广告/死链片段 ` +
        `(mainHost=${mainHost}, hostDiv=true, preRoll=${preRollSkipped})`
    );
  }

  return result.join('\n');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const allowCORS = searchParams.get('allowCORS') === 'true';
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = source
    ? config.LiveConfig?.find((s) => s.key === source)
    : null;
  const ua =
    liveSource?.ua ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 获取去广告开关：优先使用客户端传入的 adblock 参数（用户 UI 开关为权威），
  // 未传时回退到后台 EnableAdBlock 配置（live 页等无客户端上下文时生效）
  const adBlockParam = searchParams.get('adblock');
  const adBlockEnabled =
    adBlockParam !== null
      ? adBlockParam === '1'
      : config.SiteConfig?.EnableAdBlock !== false;

  let response: Response | null = null;
  let responseUsed = false;

  try {
    const decodedUrl = decodeURIComponent(url);

    const upstreamHeaders = buildUpstreamHeaders(request, decodedUrl, ua);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    response = await fetch(decodedUrl, {
      redirect: 'follow',
      credentials: 'same-origin',
      headers: upstreamHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch m3u8' },
        { status: upstreamErrorStatus(response.status) }
      );
    }

    const contentType = response.headers.get('Content-Type') || '';
    // rewrite m3u8
    if (
      contentType.toLowerCase().includes('mpegurl') ||
      contentType.toLowerCase().includes('octet-stream')
    ) {
      // 获取最终的响应URL（处理重定向后的URL）
      const finalUrl = response.url;
      const m3u8Content = await response.text();
      responseUsed = true; // 标记 response 已被使用

      // 使用最终的响应URL作为baseUrl，而不是原始的请求URL
      const baseUrl = getBaseUrl(finalUrl);

      // 先过滤广告，再重写 URL
      const filteredContent = adBlockEnabled
        ? filterAdsFromM3U8(m3u8Content)
        : m3u8Content;

      // 重写 M3U8 内容
      const modifiedContent = rewriteM3U8Content(
        filteredContent,
        baseUrl,
        request,
        allowCORS
      );

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Range, Origin, Accept'
      );
      // M3U8 缓存 5 分钟，大幅减少源站 M3U8 请求（播放器每 10s 刷新）
      headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      headers.set(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range'
      );
      return new Response(modifiedContent, { headers });
    }
    // just proxy
    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl'
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept'
    );
    // M3U8 缓存 5 分钟（非 M3U8 内容，如直播流）
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    headers.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range'
    );

    // 直接返回视频流
    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return proxyErrorResponse(error, 'm3u8');
  } finally {
    // 确保 response 被正确关闭以释放资源
    if (response && !responseUsed) {
      try {
        response.body?.cancel();
      } catch (error) {
        // 忽略关闭时的错误
        console.warn('Failed to close response body:', error);
      }
    }
  }
}

function rewriteM3U8Content(
  content: string,
  baseUrl: string,
  req: Request,
  _allowCORS: boolean
) {
  // 反代兼容：优先 X-Forwarded-Proto + X-Forwarded-Host，回退 referer/host
  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const forwardedHost = req.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();

  let protocol: string;
  let host: string;
  if (forwardedProto && forwardedHost) {
    protocol = forwardedProto;
    host = forwardedHost;
  } else {
    const referer = req.headers.get('referer');
    protocol = 'http';
    if (referer) {
      try {
        protocol = new URL(referer).protocol.replace(':', '');
      } catch (error) {
        // ignore
      }
    }
    host = req.headers.get('host') || '';
  }

  const proxyBase = `${protocol}://${host}/api/proxy`;
  const variables = new Map<string, string>(); // EXT-X-DEFINE 变量替换

  const lines = content.split('\n');
  const rewrittenLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // 处理 TS 片段 URL 和其他媒体文件
    if (line && !line.startsWith('#')) {
      let resolvedUrl = resolveUrl(baseUrl, line);
      if (variables.size)
        resolvedUrl = substituteVariables(resolvedUrl, variables);
      let host = '';
      try {
        host = new URL(resolvedUrl).hostname;
      } catch {
        /* ignore */
      }
      // 白名单内直连 CDN（国内直连快）；其余走 /segment 代理（CF 中继，解决直连慢）
      const proxyUrl = isDirectHost(host)
        ? resolvedUrl
        : `${proxyBase}/segment?url=${encodeURIComponent(resolvedUrl)}`;
      rewrittenLines.push(proxyUrl);
      continue;
    }

    // 处理变量定义 (EXT-X-DEFINE)
    if (line.startsWith('#EXT-X-DEFINE:')) {
      line = processDefineVariables(line, variables);
    }

    // 处理 EXT-X-MAP 标签中的 URI
    if (line.startsWith('#EXT-X-MAP:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'segment');
    }

    // 处理 EXT-X-KEY 标签中的 URI
    if (line.startsWith('#EXT-X-KEY:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'key');
    }

    // 处理 EXT-X-MEDIA 标签中的 URI (音轨/字幕轨)
    if (line.startsWith('#EXT-X-MEDIA:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'm3u8');
    }

    // 处理 LL-HLS 部分片段 (EXT-X-PART)
    if (line.startsWith('#EXT-X-PART:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'segment');
    }

    // 处理内容导向 (EXT-X-CONTENT-STEERING)
    if (line.startsWith('#EXT-X-CONTENT-STEERING:')) {
      line = rewriteUri(
        line,
        baseUrl,
        proxyBase,
        variables,
        'm3u8',
        'SERVER-URI'
      );
    }

    // 处理会话数据 (EXT-X-SESSION-DATA)
    if (line.startsWith('#EXT-X-SESSION-DATA:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'segment');
    }

    // 处理会话密钥 (EXT-X-SESSION-KEY)
    if (line.startsWith('#EXT-X-SESSION-KEY:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'key');
    }

    // 处理嵌套的 M3U8 文件 (EXT-X-STREAM-INF)
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      rewrittenLines.push(line);
      // 下一行通常是 M3U8 URL
      if (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          let resolvedUrl = resolveUrl(baseUrl, nextLine);
          if (variables.size)
            resolvedUrl = substituteVariables(resolvedUrl, variables);
          let host = '';
          try {
            host = new URL(resolvedUrl).hostname;
          } catch {
            /* ignore */
          }
          const proxyUrl = isDirectHost(host)
            ? resolvedUrl
            : `${proxyBase}/m3u8?url=${encodeURIComponent(resolvedUrl)}`;
          rewrittenLines.push(proxyUrl);
        } else {
          rewrittenLines.push(nextLine);
        }
      }
      continue;
    }

    // 处理日期范围标签中的 URI (EXT-X-DATERANGE)
    if (line.startsWith('#EXT-X-DATERANGE:')) {
      line = rewriteDateRangeUri(line, baseUrl, proxyBase, variables);
    }

    // 处理预加载提示 (EXT-X-PRELOAD-HINT)
    if (line.startsWith('#EXT-X-PRELOAD-HINT:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'segment');
    }

    // 处理渲染报告 (EXT-X-RENDITION-REPORT)
    if (line.startsWith('#EXT-X-RENDITION-REPORT:')) {
      line = rewriteUri(line, baseUrl, proxyBase, variables, 'm3u8');
    }

    rewrittenLines.push(line);
  }

  return rewrittenLines.join('\n');
}

const VARIABLE_REPLACEMENT_REGEX = /\{\$([a-zA-Z0-9-_]+)\}/g;

function substituteVariables(
  text: string,
  variables: Map<string, string>
): string {
  if (variables.size === 0) return text;
  return text.replace(
    VARIABLE_REPLACEMENT_REGEX,
    (variableReference: string, variableName: string) => {
      const variableValue = variables.get(variableName);
      if (variableValue === undefined) return variableReference;
      return variableValue;
    }
  );
}

function processDefineVariables(
  line: string,
  variables: Map<string, string>
): string {
  const nameMatch = line.match(/NAME="([^"]+)"/);
  const valueMatch = line.match(/VALUE="([^"]+)"/);
  if (nameMatch && valueMatch) {
    variables.set(nameMatch[1], valueMatch[1]);
  }
  return line;
}

/**
 * 通用 URI 重写：解析相对路径 → 直连或代理。
 * endpoint: segment(分片) / key(密钥) / m3u8(播放列表)
 */
function rewriteUri(
  line: string,
  baseUrl: string,
  proxyBase: string,
  variables: Map<string, string>,
  endpoint: 'segment' | 'key' | 'm3u8',
  attrName = 'URI'
): string {
  const attrMatch = line.match(new RegExp(`${attrName}="([^"]+)"`));
  if (!attrMatch) return line;

  let originalUri = attrMatch[1];
  if (variables.size) originalUri = substituteVariables(originalUri, variables);

  // 无效 URI 清洗（nan 等）→ 移除该属性让播放器忽略此轨道，避免断链
  if (!originalUri || originalUri === 'nan' || originalUri.includes('nan')) {
    return line.replace(new RegExp(`,?\\s*${attrName}="[^"]*"`), '');
  }

  try {
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    let host = '';
    try {
      host = new URL(resolvedUrl).hostname;
    } catch {
      /* ignore */
    }
    const proxyUrl = isDirectHost(host)
      ? resolvedUrl
      : `${proxyBase}/${endpoint}?url=${encodeURIComponent(resolvedUrl)}`;
    return line.replace(attrMatch[0], `${attrName}="${proxyUrl}"`);
  } catch {
    // 解析失败 → 移除 URI 属性，避免断链
    return line.replace(new RegExp(`,?\\s*${attrName}="[^"]*"`), '');
  }
}

function rewriteDateRangeUri(
  line: string,
  baseUrl: string,
  proxyBase: string,
  variables: Map<string, string>
): string {
  const uriMatches = Array.from(
    line.matchAll(/([A-Z][A-Z-]*)="([^"]*(?:https?:\/\/|\/)[^"]*)"/g)
  );
  let result = line;
  for (const match of uriMatches) {
    const fullMatch = match[0];
    const originalUri = match[2];
    let uri = originalUri;
    if (variables.size) uri = substituteVariables(uri, variables);
    try {
      const resolvedUrl = resolveUrl(baseUrl, uri);
      let host = '';
      try {
        host = new URL(resolvedUrl).hostname;
      } catch {
        /* ignore */
      }
      const proxyUrl = isDirectHost(host)
        ? resolvedUrl
        : `${proxyBase}/segment?url=${encodeURIComponent(resolvedUrl)}`;
      result = result.replace(
        fullMatch,
        fullMatch.replace(originalUri, proxyUrl)
      );
    } catch {
      // 保持原始 URI
    }
  }
  return result;
}
