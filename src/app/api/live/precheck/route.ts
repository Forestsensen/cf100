/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { buildUpstreamHeaders } from '@/lib/live';
import { proxyErrorResponse } from '@/lib/proxyError';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('moontv-source');

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  if (!liveSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = liveSource.ua || 'AptvPlayer/1.4.10';

  try {
    const decodedUrl = decodeURIComponent(url);

    // 与 proxy/m3u8、proxy/segment 统一：透传 Referer/Origin（防盗链源站必需）
    // 注：本批实测（6 源 15 分片）未复现「缺 Referer 导致失败」，故这是【写法一致性】改进，
    //     不是 bug 修复；加超时是为了避免源站慢时挂住（原先无超时）。
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(decodedUrl, {
        cache: 'no-cache',
        redirect: 'follow',
        credentials: 'same-origin',
        headers: buildUpstreamHeaders(request, decodedUrl, ua),
        signal: controller.signal,
      });
    } catch (error) {
      return proxyErrorResponse(error, 'precheck');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch', message: response.statusText },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('Content-Type');
    if (response.body) {
      response.body.cancel();
    }
    if (contentType?.includes('video/mp4')) {
      return NextResponse.json({ success: true, type: 'mp4' }, { status: 200 });
    }
    if (contentType?.includes('video/x-flv')) {
      return NextResponse.json({ success: true, type: 'flv' }, { status: 200 });
    }
    return NextResponse.json({ success: true, type: 'm3u8' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch', message: error }, { status: 500 });
  }
}