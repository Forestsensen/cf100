/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { PROXY_REQUIRED_KEYWORDS } from '@/lib/ad-rules';
import { getConfig } from '@/lib/config';
import { buildUpstreamHeaders, getBaseUrl, resolveUrl } from '@/lib/live';
import { proxyErrorResponse, upstreamErrorStatus } from '@/lib/proxyError';

export const runtime = 'edge';

function isDirectHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // 默认直连：实测 10/10 个源的分片直连都比走 CF 代理快（平均 2.75s vs 5.30s），
  // 且直连不消耗 CF 请求数（一集 300~800 个分片）。
  // 仅「已知必须走代理」的 host 例外（见 ad-rules 的 PROXY_REQUIRED_KEYWORDS）。
  if (PROXY_REQUIRED_KEYWORDS.some((k) => h.includes(k))) {
    return false;
  }
  return true;
}

/**
 * 过滤 M3U8 中的广告片段（保守关键字策略，对齐 ergTV-main 默认规则）
 *
 * 仅删除「URL 含广告关键字」的片段，跳过 #EXT-X-DISCONTINUITY 标识（不删相邻内容）。
 * 不做 host-divergence / 前贴时长 / 死链 CDN 等启发式判定，避免误删正片。
 */
function filterAdsFromM3U8(content: string): string {
  if (!content) return '';

  // 广告关键字列表（对齐 ergTV-main 默认规则）
  const adKeywords = [
    'sponsor',
    '/ad/',
    '/ads/',
    'advert',
    'advertisement',
    '/adjump',
    'redtraffic',
  ];

  // 按行分割 M3U8 内容
  const lines = content.split('\n');
  const filteredLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 跳过 #EXT-X-DISCONTINUITY 标识（不删除相邻分片，避免 A/V 不同步）
    if (line.includes('#EXT-X-DISCONTINUITY')) {
      i++;
      continue;
    }

    // 如果是 EXTINF 行，检查下一行 URL 是否包含广告关键字
    if (line.includes('#EXTINF:')) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const containsAdKeyword = adKeywords.some((keyword) =>
          nextLine.toLowerCase().includes(keyword.toLowerCase())
        );

        if (containsAdKeyword) {
          // 跳过 EXTINF 行和 URL 行
          i += 2;
          continue;
        }
      }
    }

    // 保留当前行
    filteredLines.push(line);
    i++;
  }

  return filteredLines.join('\n');
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
      // 默认直连 CDN（实测直连比 CF 中继快 10/10，且省 CF 请求数）；
      // 仅 PROXY_REQUIRED_KEYWORDS 命中的 host 走 /segment 代理
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
