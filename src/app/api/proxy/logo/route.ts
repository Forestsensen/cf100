/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { buildUpstreamHeaders } from '@/lib/live';
import { proxyErrorResponse } from '@/lib/proxyError';

export const runtime = 'edge';

// logo 体积上限：避免超大响应常驻内存/边缘缓存
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const source = searchParams.get('moontv-source');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  const ua = liveSource?.ua || 'AptvPlayer/1.4.10';

  // 边缘缓存：logo 极少变化，命中则零回源（原本每次回源 + 无限大小）
  const cache = (globalThis as any).caches?.default ?? null;
  const cacheKey = new Request(request.url);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-Cache', 'HIT');
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  try {
    const decodedUrl = decodeURIComponent(imageUrl);
    const upstreamHeaders = buildUpstreamHeaders(request, decodedUrl, ua);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const imageResponse = await fetch(decodedUrl, {
      redirect: 'follow',
      headers: upstreamHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!imageResponse.ok) {
      // 上游 4xx 透传原码（403 防盗链 / 404 失效），5xx 统一 502
      const status =
        imageResponse.status >= 400 && imageResponse.status < 500
          ? imageResponse.status
          : 502;
      return NextResponse.json(
        { error: imageResponse.statusText || 'Upstream error' },
        { status }
      );
    }

    const contentType =
      imageResponse.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase() || '';
    // 校验内容类型：只接受图片（含空/ octet-stream 容错），挡掉错误页/HTML
    const isProbablyImage =
      contentType === '' ||
      contentType.startsWith('image/') ||
      contentType === 'application/octet-stream';
    if (!isProbablyImage) {
      return NextResponse.json(
        { error: `Unexpected content-type: ${contentType || 'empty'}` },
        { status: 502 }
      );
    }

    const buffer = await imageResponse.arrayBuffer();
    if (buffer.byteLength > LOGO_MAX_BYTES) {
      return NextResponse.json({ error: 'Logo too large' }, { status: 502 });
    }

    // 创建响应头
    const headers = new Headers();
    headers.set('Content-Type', contentType || 'image/png');
    headers.set('Access-Control-Allow-Origin', '*');
    // 缓存一天，避免每个请求都回源
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    headers.set('X-Cache', 'MISS');

    const res = new Response(buffer, { status: 200, headers });
    if (cache) {
      await cache.put(cacheKey, res.clone()).catch(() => {
        /* ignore cache write failure */
      });
    }
    return res;
  } catch (error) {
    return proxyErrorResponse(error, 'logo');
  }
}
