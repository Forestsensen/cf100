/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { ApiSite, getAvailableApiSites, getConfig, refineConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { getDetailFromApi } from '@/lib/downstream';
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
      const ownerUsername = process.env.USERNAME;
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

  cronLog(
    `Cron job triggered: ${request.url}${
      targetUser ? ` (user=${targetUser})` : ''
    }`
  );

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

// 6 小时（毫秒），用于跳过近期已检查的记录（原24h太慢，2h太频繁怕被源站封IP）
const SKIP_WITHIN_6H = 6 * 60 * 60 * 1000;

// 源站连续失败次数阈值，超过后跳过该源站剩余记录
const SOURCE_FAIL_THRESHOLD = 3;

// 并发限制工具
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
  const detailCache = new Map<string, SearchResult | null>();
  let subrequestCount = 0;

  // 源站失败计数
  const failedSources = new Map<string, number>();

  // 获取可用源站列表
  const apiSites = await getAvailableApiSites();
  const apiSiteMap = new Map<string, ApiSite>();
  for (const site of apiSites) {
    apiSiteMap.set(site.key, site);
  }

  // 获取详情（直接调用 getDetailFromApi，1 subrequest）
  const getDetail = async (
    source: string,
    id: string
  ): Promise<SearchResult | null> => {
    const key = `${source}+${id}`;

    // 命中缓存直接返回
    if (detailCache.has(key)) {
      return detailCache.get(key)!;
    }

    // 检查源站是否已被标记跳过
    const failCount = failedSources.get(source) || 0;
    if (failCount >= SOURCE_FAIL_THRESHOLD) {
      return null;
    }

    // 查找源站配置
    const apiSite = apiSiteMap.get(source);
    if (!apiSite) {
      cronLog(`源站 ${source} 配置不存在，跳过`);
      detailCache.set(key, null);
      return null;
    }

    try {
      subrequestCount++;
      const detail = await getDetailFromApi(apiSite, id);
      detailCache.set(key, detail);
      // 成功则重置该源站失败计数
      failedSources.delete(source);
      return detail;
    } catch (err: any) {
      // 记录源站失败次数
      const newFailCount = (failedSources.get(source) || 0) + 1;
      failedSources.set(source, newFailCount);
      if (newFailCount >= SOURCE_FAIL_THRESHOLD) {
        cronLog(
          `⚠ 源站 ${source} 连续失败 ${newFailCount} 次，跳过该源站剩余记录`
        );
      } else {
        cronLog(
          `获取详情失败 (${source}+${id}): ${
            err.message || err
          } [失败 ${newFailCount}/${SOURCE_FAIL_THRESHOLD}]`
        );
      }
      detailCache.set(key, null);
      return null;
    }
  };

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalSkippedRecent = 0;
  let totalFailed = 0;

  try {
    let users = await db.getAllUsers();
    const ownerUsername = process.env.USERNAME;
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

        const tasks = entries.map(([key, record]) => async () => {
          if (subrequestCount >= MAX_SUBREQUESTS) return;

          try {
            const [source, id] = key.split('+');
            if (!source || !id) return;

            // 跳过 6h 内已检查/更新的记录（但如果缺少 original_episodes 则不跳过）
            const now = Date.now();
            if (record.save_time && now - record.save_time < SKIP_WITHIN_6H && record.original_episodes) {
              totalSkippedRecent++;
              return;
            }

            const detail = await getDetail(source, id);
            if (!detail) {
              totalFailed++;
              return;
            }

            const episodeCount = detail.episodes?.length || 0;
            if (episodeCount > 0 && episodeCount !== record.total_episodes) {
              // 保留原始集数（如果存在），否则使用当前集数
              const originalEpisodes = record.original_episodes || record.total_episodes;
              await db.savePlayRecord(user, source, id, {
                title: detail.title || record.title,
                source_name: record.source_name,
                cover: detail.poster || record.cover,
                index: record.index,
                total_episodes: episodeCount,
                original_episodes: originalEpisodes, // 保留原始集数
                play_time: record.play_time,
                year: detail.year || record.year,
                total_time: record.total_time,
                save_time: Date.now(),
                search_title: record.search_title,
              });
              cronLog(
                `✓ 更新播放记录: ${record.title} (${record.total_episodes} -> ${episodeCount}, 原始: ${originalEpisodes})`
              );
              totalUpdated++;
            } else {
              // 集数未变化，也更新 save_time 标记为"已检查"
              // 如果缺少 original_episodes，补充设置
              if (!record.original_episodes) {
                await db.savePlayRecord(user, source, id, {
                  ...record,
                  original_episodes: record.total_episodes,
                  save_time: now,
                });
                cronLog(`✓ 补充原始集数: ${record.title} = ${record.total_episodes}`);
              } else if (record.save_time !== now) {
                await db.savePlayRecord(user, source, id, {
                  ...record,
                  save_time: now,
                });
              }
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
              ([_, fav]: [string, any]) => fav.origin !== 'live'
            )
          );
          const favEntries = Object.entries(favorites);
          cronLog(`用户 ${user} 有 ${favEntries.length} 条收藏`);

          const tasks = favEntries.map(([key, fav]) => async () => {
            if (subrequestCount >= MAX_SUBREQUESTS) return;

            try {
              const [source, id] = key.split('+');
              if (!source || !id) return;

              // 跳过 24h 内已检查/更新的收藏
              const now = Date.now();
              if ((fav as any).save_time && now - (fav as any).save_time < SKIP_WITHIN_6H) {
                totalSkippedRecent++;
                return;
              }

              const favDetail = await getDetail(source, id);
              if (!favDetail) {
                totalFailed++;
                return;
              }

              const favEpisodeCount = favDetail.episodes?.length || 0;
              if (
                favEpisodeCount > 0 &&
                favEpisodeCount !== (fav as any).total_episodes
              ) {
                await db.saveFavorite(user, source, id, {
                  title: favDetail.title || (fav as any).title,
                  source_name: (fav as any).source_name,
                  cover: favDetail.poster || (fav as any).cover,
                  year: favDetail.year || (fav as any).year,
                  total_episodes: favEpisodeCount,
                  save_time: Date.now(),
                  search_title: (fav as any).search_title,
                } as any);
                cronLog(
                  `✓ 更新收藏: ${(fav as any).title} (${(fav as any).total_episodes} -> ${favEpisodeCount})`
                );
                totalUpdated++;
              } else {
                // 集数未变化，也更新 save_time 标记为"已检查"
                if ((fav as any).save_time !== now) {
                  await db.saveFavorite(user, source, id, {
                    ...(fav as any),
                    save_time: now,
                  });
                }
                totalSkipped++;
              }
            } catch (err: any) {
              cronLog(`处理收藏失败 (${key}): ${err}`);
              totalFailed++;
            }
          });

          await runWithConcurrency(tasks, 3);
          cronLog(`用户 ${user} 收藏处理完成 (subrequest: ${subrequestCount})`);
        } catch (err) {
          cronLog(`获取用户 ${user} 收藏失败: ${err}`);
        }
      }
    }

    // 源站失败统计
    const skippedSources = Array.from(failedSources.entries())
      .filter(([_, count]) => count >= SOURCE_FAIL_THRESHOLD)
      .map(([source, count]) => `${source}(${count}次)`);

    report.users = users.length;
    report.subrequests = subrequestCount;
    report.cacheHits = detailCache.size;
    report.updated = totalUpdated;
    report.skipped = totalSkipped;
    report.skippedRecent24h = totalSkippedRecent;
    report.failed = totalFailed;
    if (skippedSources.length > 0) {
      report.skippedSources = skippedSources;
    }
    cronLog(
      `完成: subrequest ${subrequestCount}次, 缓存 ${detailCache.size} 条, ` +
        `更新 ${totalUpdated} 条, 跳过(集数同) ${totalSkipped} 条, ` +
        `跳过(24h内) ${totalSkippedRecent} 条, 失败 ${totalFailed} 条` +
        (skippedSources.length > 0
          ? `, 源站跳过: ${skippedSources.join(', ')}`
          : '')
    );
  } catch (err) {
    cronLog(`刷新播放记录/收藏任务启动失败: ${err}`);
    report.error = String(err);
  }

  return report;
}

async function refreshAllLiveChannels() {
  const config = await getConfig();

  const refreshPromises = (config.LiveConfig || [])
    .filter((liveInfo: any) => !liveInfo.disabled)
    .map(async (liveInfo: any) => {
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

  await Promise.all(refreshPromises);
  await db.saveAdminConfig(config);
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
      await db.saveAdminConfig(config);
    } catch (e) {
      console.error('刷新配置失败:', e);
    }
  } else {
    console.log('跳过刷新：未配置订阅地址或自动更新');
  }
}
