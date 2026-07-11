/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config";
import { buildUpstreamHeaders } from "@/lib/live";

export const runtime = 'edge';

// 分片缓存时长（秒）—— 分片内容不变，长缓存可大幅减少源站请求
const SEGMENT_CACHE_TTL = 7200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = source ? config.LiveConfig?.find((s: any) => s.key === source) : null;
  const ua = liveSource?.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const decodedUrl = decodeURIComponent(url);
  const clientRange = request.headers.get('Range') || '';

  // 仅对「整片请求」(无 Range) 使用 Cache API 缓存；Range 请求透传不缓存，避免缓存键错乱
  const cacheKey = clientRange ? null : new Request(decodedUrl, { method: 'GET' });
  const cache = (globalThis as any).caches?.default ?? null;

  if (cache && cacheKey) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const cachedAt = Number(cached.headers.get('X-Cached-At') || '0');
      const age = Date.now() - cachedAt;
      const headers = new Headers(cached.headers);
      headers.set('X-Cache', 'HIT');
      if (age < SEGMENT_CACHE_TTL * 1000) {
        // 新鲜：直接返回，零回源
        return new Response(cached.body, { status: cached.status, headers });
      }
      // 陈旧但可用：立即返回旧片，后台异步刷新（stale-while-revalidate）
      revalidateInBackground(cache, cacheKey, decodedUrl, ua);
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  // 回源（透传客户端 Range + 上游防盗链头，支持播放器 seek）
  const upstreamHeaders = buildUpstreamHeaders(request, decodedUrl, ua);
  if (clientRange) upstreamHeaders['Range'] = clientRange;

  let upstream: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    upstream = await fetch(decodedUrl, { headers: upstreamHeaders, signal: controller.signal });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'video/mp2t');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) headers.set('Content-Range', contentRange);

  const isFull = !clientRange && upstream.status === 200;
  if (isFull) {
    // 整片：强制长 TTL 缓存（解决源站回 no-store/Set-Cookie 导致 cf.cacheTtl 失效、命中率 0% 的问题）
    headers.set('Cache-Control', `public, max-age=${SEGMENT_CACHE_TTL}, s-maxage=${SEGMENT_CACHE_TTL}`);
    headers.set('X-Cache', 'MISS');
  } else {
    // Range/206 或异常响应：不缓存，仅允许客户端短期缓存
    headers.set('Cache-Control', 'public, max-age=300');
    headers.set('X-Cache', clientRange ? 'BYPASS-RANGE' : 'MISS');
  }

  // 缓存整片（仅 200 且无 Range）
  if (cache && cacheKey && isFull) {
    const cloned = upstream.clone();
    const cacheable = new Response(cloned.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: new Headers(headers),
    });
    cacheable.headers.set('X-Cached-At', String(Date.now()));
    cacheable.headers.delete('Set-Cookie');
    await cache.put(cacheKey, cacheable).catch(() => { /* ignore cache write failure */ });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

// 后台异步刷新陈旧缓存（stale-while-revalidate），不阻塞响应
function revalidateInBackground(cache: any, cacheKey: Request, url: string, ua: string) {
  const task = (async () => {
    try {
      const fresh = await fetch(url, { headers: { 'User-Agent': ua } });
      if (!fresh.ok) return;
      const cacheable = new Response(fresh.clone().body, {
        status: fresh.status,
        statusText: fresh.statusText,
        headers: new Headers({
          'Content-Type': 'video/mp2t',
          'Cache-Control': `public, max-age=${SEGMENT_CACHE_TTL}, s-maxage=${SEGMENT_CACHE_TTL}`,
          'X-Cached-At': String(Date.now()),
        }),
      });
      cacheable.headers.delete('Set-Cookie');
      await cache.put(cacheKey, cacheable);
    } catch {
      // 刷新失败忽略，下次请求仍命中旧片
    }
  })();
  if (typeof (globalThis as any).waitUntil === 'function') {
    (globalThis as any).waitUntil(task);
  }
}