import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  API_CONFIG,
  getAvailableApiSites,
  getCacheTime,
  getConfig,
} from '@/lib/config';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

interface SourceModeItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

const buildSourceUrl = (api: string, typeId: string | null, page: string) => {
  const url = new URL(api);
  if (typeId) {
    url.searchParams.set('ac', 'videolist');
    url.searchParams.set('t', typeId);
  }
  if (page !== '1' || typeId) {
    url.searchParams.set('pg', page);
  }
  return url.toString();
};

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const typeId = searchParams.get('typeId');
  const page = searchParams.get('page') || '1';

  if (!sourceKey) {
    return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });
  }

  const apiSites = await getAvailableApiSites(authInfo.username);
  const targetSite = apiSites.find((site) => site.key === sourceKey);
  if (!targetSite) {
    return NextResponse.json({ error: '未找到指定的视频源' }, { status: 404 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(buildSourceUrl(targetSite.api, typeId, page), {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `源请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const list = Array.isArray(data?.list) ? data.list : [];
    const classes = Array.isArray(data?.class) ? data.class : [];
    const config = await getConfig();

    let filteredList = list;
    if (!config.SiteConfig.DisableYellowFilter) {
      filteredList = filteredList.filter((item: SourceModeItem) => {
        const typeName = item.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    const cacheTime = await getCacheTime();
    return NextResponse.json(
      {
        source: targetSite,
        class: classes,
        list: filteredList,
        page: Number(data?.page || page),
        pagecount: Number(data?.pagecount || 1),
        total: Number(data?.total || filteredList.length),
      },
      {
        headers: {
          'Cache-Control': `private, max-age=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      }
    );
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'AbortError' ? 504 : 500;
    return NextResponse.json({ error: '源请求失败' }, { status });
  } finally {
    clearTimeout(timeoutId);
  }
}
