/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config";
import { buildUpstreamHeaders } from "@/lib/live";

export const runtime = 'edge';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const KEY_CACHE_TTL = 3600;

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
    return cached;
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
      return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
    }

    const keyData = await response.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Cache-Control', `public, max-age=${KEY_CACHE_TTL}`);
    headers.set('Expires', new Date(Date.now() + KEY_CACHE_TTL * 1000).toUTCString());

    const res = new Response(keyData, { status: 200, headers });
    // key 体积小，直接 await 写入边缘缓存，避免上下文被回收
    await cache.put(cacheKey, res.clone());
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
  }
}