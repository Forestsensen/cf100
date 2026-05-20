/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getOwnerUsername } from '@/lib/cf-env';
import { getConfig, refineConfig, saveAndInvalidateConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { fetchVideoDetail } from '@/lib/fetchVideoDetail';
import { refreshLiveChannels } from '@/lib/live';
import { SearchResult } from '@/lib/types';

export const runtime = 'edge';

// 诊断日志收集
const cronLogs: string[] = [];
function cronLog(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  cronLogs.push(line);
}

export async function GET(request: NextRequest) {
  cronLogs.length = 0;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const targetUser = url.searchParams.get('user');

  // ?action=users — 轻量查询，只返回用户列表（给 cron-worker 用）
  if (action === 'users') {
    try {
      const users = await db.getAllUsers();
      const ownerUsername = await getOwnerUsername();
      if (ownerUsername && !users.includes(ownerUsername)) {
        users.push(ownerUsername);
      }
      return NextResponse.json({ success: true, users });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  cronLog(`Cron job triggered: ${request.url}${targetUser ? ` (user=${targetUser})` : ''}`);

  try {
    const result = await cronJobWithReport(targetUser || undefined);

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      ...result,
      logs: cronLogs,
    });
  } catch (error) {
    console.error('Cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Cron job failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        logs: cronLogs,
      },
      { status: 500 }
    );
  }
}

// Cloudflare Free plan 每次请求最多 50 次 subrequest
// 保守设置为 40，留 10 次余量给配置刷新等其他操作
const MAX_SUBREQUESTS = 40;

// 并发限制工具（移植自 LunaTV）
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );
  return results;
}

async function cronJobWithReport(targetUser?: string) {
  const report: Record<string, unknown> = {};

  // 1. 刷新配置
  await refreshConfig();
  report.configDone = true;

  // 2. 刷新直播源
  await refreshAllLiveChannels();
  report.liveDone = true;

  // 3. 刷新播放记录/收藏
  // 函数级缓存：key 为 `${source}+${id}`，缓存 fetchVideoDetail 结果（移植自 LunaTV）
  const detailCache = new Map<string, SearchResult | null>();
  let subrequestCount = 0;

  // 获取详情（带缓存和错误处理，移植自 LunaTV）
  const getDetail = async (
    source: string,
    id: string,
    fallbackTitle: string
  ): Promise<SearchResult | null> => {
    const key = `${source}+${id}`;
    if (detailCache.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return detailCache.get(key)!;
    }
    try {
      subrequestCount++;
      const detail = await fetchVideoDetail({
        source,
        id,
        fallbackTitle: fallbackTitle.trim(),
      });
      detailCache.set(key, detail);
      return detail;
    } catch (err: any) {
      cronLog(`获取详情失败 (${source}+${id}): ${err.message || err}`);
      detailCache.set(key, null);
      return null;
    }
  };

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    let users = await db.getAllUsers();
    const ownerUsername = await getOwnerUsername();
    if (ownerUsername && !users.includes(ownerUsername)) {
      users.push(ownerUsername);
    }

    // 如果指定了用户，只处理该用户
    if (targetUser) {
      users = users.filter((u) => u === targetUser);
      if (users.length === 0) {
        cronLog(`指定用户 ${targetUser} 不存在`);
        report.error = `User ${targetUser} not found`;
        return report;
      }
    }

    cronLog(`找到 ${users.length} 个用户: ${users.join(', ') || '(无)'}`);

    // 逐用户处理
    for (const user of users) {
      if (subrequestCount >= MAX_SUBREQUESTS) {
        cronLog(`已达 subrequest 上限 (${subrequestCount})，跳过剩余用户`);
        break;
      }

      cronLog(`开始处理用户: ${user}`);

      // 播放记录
      try {
        const playRecords = await db.getAllPlayRecords(user);
        const entries = Object.entries(playRecords);
        cronLog(`用户 ${user} 有 ${entries.length} 条播放记录`);

        // 小批量并发（3个一组），在 subrequest 限制内适度并发
        const tasks = entries.map(([key, record]) => async () => {
          if (subrequestCount >= MAX_SUBREQUESTS) return;

          try {
            const [source, id] = key.split('+');
            if (!source || !id) return;

            const detail = await getDetail(source, id, record.title);
            if (!detail) {
              totalFailed++;
              return;
            }

            const episodeCount = detail.episodes?.length || 0;
            if (episodeCount > 0 && episodeCount !== record.total_episodes) {
              await db.savePlayRecord(user, source, id, {
                title: detail.title || record.title,
                source_name: record.source_name,
                cover: detail.poster || record.cover,
                index: record.index,
                total_episodes: episodeCount,
                play_time: record.play_time,
                year: detail.year || record.year,
                total_time: record.total_time,
                save_time: record.save_time,
                search_title: record.search_title,
              });
              cronLog(
                `✓ 更新播放记录: ${record.title} (${record.total_episodes} -> ${episodeCount})`
              );
              totalUpdated++;
            } else {
              totalSkipped++;
            }
          } catch (err: any) {
            cronLog(`处理播放记录失败 (${key}): ${err}`);
            totalFailed++;
          }
        });

        await runWithConcurrency(tasks, 3);
        cronLog(
          `用户 ${user} 播放记录处理完成 (subrequest: ${subrequestCount})`
        );
      } catch (err) {
        cronLog(`获取用户 ${user} 播放记录失败: ${err}`);
      }

      // 收藏
      if (subrequestCount < MAX_SUBREQUESTS) {
        try {
          let favorites = await db.getAllFavorites(user);
          favorites = Object.fromEntries(
            Object.entries(favorites).filter(
              ([_, fav]) => fav.origin !== 'live'
            )
          );
          const favEntries = Object.entries(favorites);
          cronLog(`用户 ${user} 有 ${favEntries.length} 条收藏`);

          const tasks = favEntries.map(([key, fav]) => async () => {
            if (subrequestCount >= MAX_SUBREQUESTS) return;

            try {
              const [source, id] = key.split('+');
              if (!source || !id) return;

              const favDetail = await getDetail(source, id, fav.title);
              if (!favDetail) {
                totalFailed++;
                return;
              }

              const favEpisodeCount = favDetail.episodes?.length || 0;
              if (
                favEpisodeCount > 0 &&
                favEpisodeCount !== fav.total_episodes
              ) {
                await db.saveFavorite(user, source, id, {
                  title: favDetail.title || fav.title,
                  source_name: fav.source_name,
                  cover: favDetail.poster || fav.cover,
                  year: favDetail.year || fav.year,
                  total_episodes: favEpisodeCount,
                  save_time: fav.save_time,
                  search_title: fav.search_title,
                });
                cronLog(
                  `✓ 更新收藏: ${fav.title} (${fav.total_episodes} -> ${favEpisodeCount})`
                );
                totalUpdated++;
              } else {
                totalSkipped++;
              }
            } catch (err: any) {
              cronLog(`处理收藏失败 (${key}): ${err}`);
              totalFailed++;
            }
          });

          await runWithConcurrency(tasks, 3);
          cronLog(
            `用户 ${user} 收藏处理完成 (subrequest: ${subrequestCount})`
          );
        } catch (err) {
          cronLog(`获取用户 ${user} 收藏失败: ${err}`);
        }
      }
    }

    report.users = users.length;
    report.subrequests = subrequestCount;
    report.cacheHits = detailCache.size;
    report.updated = totalUpdated;
    report.skipped = totalSkipped;
    report.failed = totalFailed;
    cronLog(
      `完成: subrequest ${subrequestCount}次, 缓存 ${detailCache.size} 条, 更新 ${totalUpdated} 条, 跳过 ${totalSkipped} 条, 失败 ${totalFailed} 条`
    );
  } catch (err) {
    cronLog(`刷新播放记录/收藏任务启动失败: ${err}`);
    report.error = String(err);
  }

  return report;
}

async function refreshAllLiveChannels() {
  const config = await getConfig();

  // 并发刷新所有启用的直播源
  const refreshPromises = (config.LiveConfig || [])
    .filter((liveInfo) => !liveInfo.disabled)
    .map(async (liveInfo) => {
      try {
        const nums = await refreshLiveChannels(liveInfo);
        liveInfo.channelNumber = nums;
      } catch (error) {
        console.error(
          `刷新直播源失败 [${liveInfo.name || liveInfo.key}]:`,
          error
        );
        liveInfo.channelNumber = 0;
      }
    });

  // 等待所有刷新任务完成
  await Promise.all(refreshPromises);

  // 保存配置
  await saveAndInvalidateConfig(config);
}

async function refreshConfig() {
  let config = await getConfig();
  if (
    config &&
    config.ConfigSubscribtion &&
    config.ConfigSubscribtion.URL &&
    config.ConfigSubscribtion.AutoUpdate
  ) {
    try {
      const response = await fetch(config.ConfigSubscribtion.URL);

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const configContent = await response.text();

      // 对 configContent 进行 base58 解码
      let decodedContent;
      try {
        const bs58 = (await import('bs58')).default;
        const decodedBytes = bs58.decode(configContent);
        decodedContent = new TextDecoder().decode(decodedBytes);
      } catch (decodeError) {
        console.warn('Base58 解码失败:', decodeError);
        throw decodeError;
      }

      try {
        JSON.parse(decodedContent);
      } catch (e) {
        throw new Error('配置文件格式错误，请检查 JSON 语法');
      }
      config.ConfigFile = decodedContent;
      config.ConfigSubscribtion.LastCheck = new Date().toISOString();
      config = refineConfig(config);
      await saveAndInvalidateConfig(config);
    } catch (e) {
      console.error('刷新配置失败:', e);
    }
  } else {
    console.log('跳过刷新：未配置订阅地址或自动更新');
  }
}
