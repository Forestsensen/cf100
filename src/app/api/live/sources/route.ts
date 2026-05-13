/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  console.log(request.url)
  try {
    const config = await getConfig();

    if (!config) {
      return NextResponse.json({ error: '配置未找�? }, { status: 404 });
    }

    // 过滤出所有非 disabled 的直播源
    const liveSources = (config.LiveConfig || []).filter(source => !source.disabled);

    return NextResponse.json({
      success: true,
      data: liveSources
    });
  } catch (error) {
    console.error('获取直播源失�?', error);
    return NextResponse.json(
      { error: '获取直播源失�? },
      { status: 500 }
    );
  }
}
