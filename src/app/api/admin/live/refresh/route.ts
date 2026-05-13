/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { refreshLiveChannels } from '@/lib/live';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // 权限检�?    const authInfo = getAuthInfoFromCookie(request);
    const username = authInfo?.username;
    const config = await getConfig();
    if (username !== process.env.USERNAME) {
      // 管理�?      const user = config.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 并发刷新所有启用的直播�?    const refreshPromises = (config.LiveConfig || [])
      .filter(liveInfo => !liveInfo.disabled)
      .map(async (liveInfo) => {
        try {
          const nums = await refreshLiveChannels(liveInfo);
          liveInfo.channelNumber = nums;
        } catch (error) {
          liveInfo.channelNumber = 0;
        }
      });

    // 等待所有刷新任务完�?    await Promise.all(refreshPromises);

    // 保存配置
    await db.saveAdminConfig(config);

    return NextResponse.json({
      success: true,
      message: '直播源刷新成�?,
    });
  } catch (error) {
    console.error('直播源刷新失�?', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刷新失败' },
      { status: 500 }
    );
  }
}
