/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { buildUpstreamHeaders } from '@/lib/live';
import { proxyErrorResponse } from '@/lib/proxyError';

export const runtime = 'edge';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const KEY_CACHE_TTL = 3600;

// 稳定哈希：同一 URL 的 key 内容不变，用 URL 派生 ETag，支持 304 条件请求
function fastHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(url);

  // 无 source 时直接用默认 UA，跳过 getConfig 重算（热路径优化）
  let ua = DEFAULT_UA;
  if (source) {
    const config = await getConfig();
    const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
    ua = liveSource?.ua || DEFAULT_UA;
  }

  // 边缘缓存：key 极少变化，命中则零回源
  // @ts-expect-error caches.default is valid in Cloudflare Workers runtime
  const cache = (caches as { default: Cache }).default;
  const cacheKey = new Request(request.url);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const etag = cached.headers.get('ETag');
    // 客户端带 If-None-Match 且命中 → 直接 304，省流量
    if (etag && request.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': `public, max-age=${KEY_CACHE_TTL}`,
        },
      });
    }
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(decodedUrl, {
      headers: buildUpstreamHeaders(request, decodedUrl, ua),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const status =
        response.status >= 400 && response.status < 500 ? response.status : 502;
      return NextResponse.json({ error: 'Failed to fetch key' }, { status });
    }

    const keyData = await response.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Cache-Control', `public, max-age=${KEY_CACHE_TTL}`);
    headers.set(
      'Expires',
      new Date(Date.now() + KEY_CACHE_TTL * 1000).toUTCString()
    );
    // ETag：优先用上游的，否则用 URL 派生（同 URL 的 key 内容不变）
    const etag = response.headers.get('etag') || `W/"${fastHash(decodedUrl)}"`;
    headers.set('ETag', etag);

    const res = new Response(keyData, { status: 200, headers });
    // key 体积小，直接 await 写入边缘缓存，避免上下文被回收
    await cache.put(cacheKey, res.clone());
    return res;
  } catch (error) {
    return proxyErrorResponse(error, 'key');
  }
}
