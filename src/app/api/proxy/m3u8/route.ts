/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { buildUpstreamHeaders, getBaseUrl, resolveUrl } from '@/lib/live';
import { proxyErrorResponse, upstreamErrorStatus } from '@/lib/proxyError';

export const runtime = 'edge';

// 已知的广告域名（精确匹配，避免误杀正常 CDN）
const AD_DOMAINS: string[] = [
  // 欧美通用广告网络
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adsterra.com',
  'propellerads.com',
  'popads.net',
  'revive-adserver.net',
  'mediaad.org',
  // 爱奇艺广告特征
  'cupid.iqiyi.com',
  'afp.iqiyi.com',
  'ad.m.iqiyi.com',
  'policy.video.iqiyi.com',
  't7.cupid.iqiyi.com',
  // 猫眼/美团广告特征
  'ad.maoyan.com',
  'analytics.maoyan.com',
  's3plus.meituan.com',
  'report.meituan.com',
  'analytics.meituan.com',
  'stat.mafengwo.cn',
];

// 已知死链/防盗链 CDN 节点（监控报告高频 4xx，跳过避免播放中断）
const DEAD_CDN_DOMAINS: string[] = [
  'vv.jisuzyv.com',
  'vip.ffzy-plays.com',
  'ukzy.ukubf3.com',
  'v2.ppqrrs.com',
  'v10.ppqrrs.com',
];

// 直连白名单：这些源的 TS/分片直连 CDN（国内直连快，省去 CF 中转、保白天高速）
// 匹配方式 = 分片 URL 主机名包含以下关键字（覆盖其 API 与 CDN 域名）
const DIRECT_HOST_KEYWORDS: string[] = [
  'dytt', // 电影天堂（caiji.dyttzyapi.com / vip.dytt-tvs.com）
  'iqiyi', // 爱奇艺（iqiyizyapi.com）
  'yzzy', // 爱奇艺 CDN（api.yzzy-api.com / cdn.yzzy31-play.com）
];
function isDirectHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return DIRECT_HOST_KEYWORDS.some((k) => h.includes(k));
}

/**
 * 检测一行是否为广告片段 URL（保守策略，只匹配确定的广告）
 */
function isAdSegmentUrl(line: string): boolean {
  try {
    const url = new URL(line);
    const hostname = url.hostname.toLowerCase();
    // 精确匹配广告域名
    for (const domain of AD_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
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
 */
function filterAdsFromM3U8(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inAdBlock = false;
  let removedSegments = 0;

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
    if (inAdBlock) {
      continue;
    }

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

    result.push(line);
  }

  if (removedSegments > 0) {
    console.log(`[AdBlock] 已移除 ${removedSegments} 个广告/死链片段`);
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
    ? config.LiveConfig?.find((s: any) => s.key === source)
    : null;
  const ua =
    liveSource?.ua ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 获取去广告开关（默认开启）
  const adBlockEnabled = config.SiteConfig?.EnableAdBlock !== false;

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
