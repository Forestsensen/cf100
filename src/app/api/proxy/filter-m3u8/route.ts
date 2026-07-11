/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

export const runtime = 'edge';

// 广告过滤关键字列表（服务端过滤，适用于所有浏览器包括 Safari）
// 注意：不要用 /ad/、/ads/ 等过于宽泛的关键词，会误杀正常视频 URL
const AD_KEYWORDS = [
  // 爱艺奇/爱奇艺 广告特征
  'cupid.iqiyi.com', 'afp.iqiyi.com', 'ad.m.iqiyi.com',
  'policy.video.iqiyi.com', 't7.cupid.iqiyi.com',
  // 猫眼广告特征
  'ad.maoyan.com', 'analytics.maoyan.com',
  'maoyan.com/advert', 'maoyan.com/tracking',
  'analytics.meituan', 'stat.mafengwo',
  'meituan.com/advert', 'meituan.com/tracking',
  's3plus.meituan.com', 'report.meituan.com',
  // 通用广告特征
  'pre_roll', 'mid_roll', 'post_roll',
  'preroll', 'midroll', 'postroll',
  // 广告 CDN 域名
  'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
];

/**
 * 过滤 M3U8 中的广告分段
 */
function filterAdsFromM3U8(content: string): string {
  const lines = content.split('\n');
  const filteredLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 跳过 #EXT-X-DISCONTINUITY 标识
    if (line.includes('#EXT-X-DISCONTINUITY')) {
      i++;
      continue;
    }

    // 如果是 EXTINF 行，检查下一行 URL 是否包含广告关键字
    if (line.includes('#EXTINF:')) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const containsAd = AD_KEYWORDS.some(keyword =>
          nextLine.toLowerCase().includes(keyword.toLowerCase())
        );

        if (containsAd) {
          // 跳过 EXTINF 行和 URL 行
          i += 2;
          continue;
        }
      }
    }

    filteredLines.push(line);
    i++;
  }

  return filteredLines.join('\n');
}

/**
 * GET /api/proxy/filter-m3u8?url=xxx
 * 代理 M3U8 请求并过滤广告分段
 * 适用于所有浏览器，特别是 iOS Safari（原生 HLS 播放）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let response: Response | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);

    response = await fetch(decodedUrl, {
      redirect: 'follow',
      // @ts-expect-error cf property is valid in Cloudflare Workers runtime
      cf: { cacheTtl: 300 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch M3U8: ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('Content-Type') || '';
    const isM3U8 = contentType.toLowerCase().includes('mpegurl') ||
                   contentType.toLowerCase().includes('octet-stream') ||
                   decodedUrl.endsWith('.m3u8');

    if (isM3U8) {
      const m3u8Content = await response.text();
      const filteredContent = filterAdsFromM3U8(m3u8Content);

      const headers = new Headers();
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
      headers.set('Cache-Control', 'public, max-age=300');

      return new Response(filteredContent, { status: 200, headers });
    }

    // 非 M3U8 文件直接代理
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'no-cache');

    return new Response(response.body, { status: 200, headers });

  } catch (error) {
    console.error('[filter-m3u8] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy M3U8', details: (error as Error).message },
      { status: 500 }
    );
  }
}
