/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config";
import { getBaseUrl, resolveUrl } from "@/lib/live";

export const runtime = 'edge';

// 已知的广告域名（精确匹配，避免误杀正常 CDN）
const AD_DOMAINS: string[] = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adsterra.com',
  'propellerads.com',
  'popads.net',
  'revive-adserver.net',
  'mediaad.org',
];

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

    // 检测独立广告片段 URL
    if (trimmed && !trimmed.startsWith('#') && isAdSegmentUrl(trimmed)) {
      // 跳过前一行的 #EXTINF
      if (result.length > 0 && result[result.length - 1].trim().startsWith('#EXTINF')) {
        result.pop();
      }
      removedSegments++;
      continue;
    }

    result.push(line);
  }

  if (removedSegments > 0) {
    console.log(`[AdBlock] 已移除 ${removedSegments} 个广告片段`);
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
  const liveSource = source ? config.LiveConfig?.find((s: any) => s.key === source) : null;
  const ua = liveSource?.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 获取去广告开关（默认开启）
  const adBlockEnabled = config.SiteConfig?.EnableAdBlock !== false;

  let response: Response | null = null;
  let responseUsed = false;

  try {
    const decodedUrl = decodeURIComponent(url);

    response = await fetch(decodedUrl, {
      redirect: 'follow',
      credentials: 'same-origin',
      headers: {
        'User-Agent': ua,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch m3u8' }, { status: 500 });
    }

    const contentType = response.headers.get('Content-Type') || '';
    // rewrite m3u8
    if (contentType.toLowerCase().includes('mpegurl') || contentType.toLowerCase().includes('octet-stream')) {
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
      const modifiedContent = rewriteM3U8Content(filteredContent, baseUrl, request, allowCORS);

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
      // M3U8 缓存 5 分钟，大幅减少源站 M3U8 请求（播放器每 10s 刷新）
      headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      return new Response(modifiedContent, { headers });
    }
    // just proxy
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
    // M3U8 缓存 5 分钟（非 M3U8 内容，如直播流）
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    // 直接返回视频流
    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch m3u8' }, { status: 500 });
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

function rewriteM3U8Content(content: string, baseUrl: string, req: Request, allowCORS: boolean) {
  // 从 referer 头提取协议信息
  const referer = req.headers.get('referer');
  let protocol = 'http';
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      protocol = refererUrl.protocol.replace(':', '');
    } catch (error) {
      // ignore
    }
  }

  const host = req.headers.get('host');
  const proxyBase = `${protocol}://${host}/api/proxy`;

  const lines = content.split('\n');
  const rewrittenLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // 处理 TS 片段 URL 和其他媒体文件
    if (line && !line.startsWith('#')) {
      const resolvedUrl = resolveUrl(baseUrl, line);
      // TS 分片直连 CDN，不通过 CF 代理，彻底消除源站 IP 暴露
      const proxyUrl = resolvedUrl;
      rewrittenLines.push(proxyUrl);
      continue;
    }

    // 处理 EXT-X-MAP 标签中的 URI
    if (line.startsWith('#EXT-X-MAP:')) {
      line = rewriteMapUri(line, baseUrl, proxyBase);
    }

    // 处理 EXT-X-KEY 标签中的 URI
    if (line.startsWith('#EXT-X-KEY:')) {
      line = rewriteKeyUri(line, baseUrl, proxyBase);
    }

    // 处理嵌套的 M3U8 文件 (EXT-X-STREAM-INF)
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      rewrittenLines.push(line);
      // 下一行通常是 M3U8 URL
      if (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          const resolvedUrl = resolveUrl(baseUrl, nextLine);
          const proxyUrl = `${proxyBase}/m3u8?url=${encodeURIComponent(resolvedUrl)}`;
          rewrittenLines.push(proxyUrl);
        } else {
          rewrittenLines.push(nextLine);
        }
      }
      continue;
    }

    rewrittenLines.push(line);
  }

  return rewrittenLines.join('\n');
}

function rewriteMapUri(line: string, baseUrl: string, proxyBase: string) {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    const proxyUrl = `${proxyBase}/segment?url=${encodeURIComponent(resolvedUrl)}`;
    return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
  }
  return line;
}

function rewriteKeyUri(line: string, baseUrl: string, proxyBase: string) {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    const proxyUrl = `${proxyBase}/key?url=${encodeURIComponent(resolvedUrl)}`;
    return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
  }
  return line;
}