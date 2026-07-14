/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { ApiSite, getAvailableApiSites, getConfig, refineConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { getDetailFromApi } from '@/lib/downstream';
import { refreshLiveChannels } from '@/lib/live';
import { SearchResult } from '@/lib/types';

export const runtime = 'edge';

// 诊断日志收集（O8：最多保留最近 50 条，且只在 ?debug=1 时随响应返回）
const cronLogs: string[] = [];
function cronLog(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  cronLogs.push(line);
  if (cronLogs.length > 50) cronLogs.splice(0, cronLogs.length - 50);
}

// ─────────────────────────────────────────────────────────────────────────
// O3：可选的 KV 记录「最近检查时间」，替代集数未变时每轮落库写操作。
// 绑定名为 CRON_STATE 的 KV 命名空间后自动启用；未绑定时回退主表 save_time 逻辑，行为不变。
declare const CRON_STATE: any;
const cronKV = typeof CRON_STATE !== 'undefined' ? CRON_STATE : null;

async function markChecked(user: string, source: string, id: string) {
  if (!cronKV) return;
  try {
    await cronKV.put(`chk:${user}:${source}:${id}`, String(Date.now()), {
      expirationTtl: 60 * 60 * 24, // 自动过期，避免无限增长
    });
  } catch {
    /* ignore */
  }
}
async function getLastChecked(user: string, source: string, id: string): Promise<number> {
  if (!cronKV) return 0;
  try {
    const v = await cronKV.get(`chk:${user}:${source}:${id}`);
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  cronLogs.length = 0;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const targetUser = url.searchParams.get('user');
  const debug = url.searchParams.get('debug') === '1';

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

  // O2：?action=refresh 仅刷新配置+直播源（替代原 Worker 的 base call 全量处理）
  if (action === 'refresh') {
    try {
      await refreshConfig();
      await refreshAllLiveChannels();
      lastRefreshTs = Date.now();
      return NextResponse.json({ success: true, configDone: true, liveDone: true });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  cronLog(
    `Cron job triggered: ${request.url}${
      targetUser ? ` (user=${targetUser})` : ''
    }${url.searchParams.get('skipRefresh') === '1' ? ' [skipRefresh]' : ''}`
  );

  try {
    const result = await cronJobWithReport(
      targetUser || undefined,
      url.searchParams.get('skipRefresh') === '1'
    );

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      ...result,
      ...(debug ? { logs: cronLogs } : {}),
    });
  } catch (error) {
    console.error('Cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Cron job failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        ...(debug ? { logs: cronLogs } : {}),
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

// O2：config/live 刷新去抖窗口（10 分钟），避免 Worker 多次调用时反复刷新
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

// O5：cron 抓取详情超时（后台任务，放宽到 8s；前端调用走默认 2s）
const CRON_DETAIL_TIMEOUT = 8000;

// O2：上次 config/live 刷新时间戳（模块级，热实例内生效）
let lastRefreshTs = 0;

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

async function cronJobWithReport(targetUser?: string, skipRefresh = false) {
  const report: Record<string, unknown> = {};

  // 1~2. 刷新配置 + 直播源（O2 去抖）
  if (skipRefresh) {
    cronLog('skipRefresh=1，跳过配置/直播源刷新');
    report.configDone = 'skipped';
    report.liveDone = 'skipped';
  } else {
    const now = Date.now();
    if (now - lastRefreshTs < REFRESH_COOLDOWN_MS) {
      cronLog(
        `配置/直播源 ${Math.round(
          (REFRESH_COOLDOWN_MS - (now - lastRefreshTs)) / 1000
        )}s 内已刷新，跳过(O2去抖)`
      );
      report.configDone = 'debounced';
      report.liveDone = 'debounced';
    } else {
      await refreshConfig();
      await refreshAllLiveChannels();
      lastRefreshTs = now;
      report.configDone = true;
      report.liveDone = true;
    }
  }

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

  // 获取详情（直接调用 getDetailFromApi，1 subrequest，cron 超时 8s）
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
      const detail = await getDetailFromApi(apiSite, id, CRON_DETAIL_TIMEOUT);
      detailCache.set(key, detail);
      // O9：成功时失败计数 -1（衰减而非清零），并发下阈值更稳定
      const fc = failedSources.get(source) || 0;
      if (fc > 0) failedSources.set(source, fc - 1);
      return detail;
    } catch (err: any) {
      // 记录源站失败次数
      const newFailCount = (failedSources.get(source) || 0) + 1;
      failedSources.set(source, newFailCount);
      if (newFailCount >= SOURCE_FAIL_THRESHOLD) {
        cronLog(
          `⚠ 源站 ${source} 失败 ${newFailCount} 次，跳过该源站剩余记录`
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

            // O3：跳过近期已检查（优先 KV，否则回退主表 save_time）
            const lastCheck = cronKV
              ? await getLastChecked(user, source, id)
              : (record.save_time || 0);
            if (lastCheck && Date.now() - lastCheck < SKIP_WITHIN_6H && record.original_episodes) {
              totalSkippedRecent++;
              return;
            }

            const detail = await getDetail(source, id);
            if (!detail) {
              totalFailed++;
              return;
            }

            // O4：优先用源站真实总集数 vod_total，否则回退 episodes.length
            const episodeCount =
              detail.totalEpisodes && detail.totalEpisodes > 0
                ? detail.totalEpisodes
                : (detail.episodes?.length || 0);

            if (episodeCount > 0 && episodeCount !== record.total_episodes) {
              const originalEpisodes = record.original_episodes || record.total_episodes;

              // O6：集数异常减少（>30%）疑似源站故障，不覆盖，仅标记已检查
              if (
                originalEpisodes > 0 &&
                episodeCount < originalEpisodes &&
                (originalEpisodes - episodeCount) / originalEpisodes > 0.3
              ) {
                cronLog(
                  `⚠ 集数异常减少，疑似源站故障，跳过: ${record.title} (${record.total_episodes} -> ${episodeCount}, 原始: ${originalEpisodes})`
                );
                await markChecked(user, source, id);
                totalSkipped++;
                return;
              }

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
              // 集数未变：O3 用 KV 记录检查时间（不写主表）；无 KV 时才回退写 save_time
              await markChecked(user, source, id);
              if (!record.original_episodes) {
                await db.savePlayRecord(user, source, id, {
                  ...record,
                  original_episodes: record.total_episodes,
                  save_time: Date.now(),
                });
                cronLog(`✓ 补充原始集数: ${record.title} = ${record.total_episodes}`);
              } else if (!cronKV && record.save_time !== Date.now()) {
                await db.savePlayRecord(user, source, id, {
                  ...record,
                  save_time: Date.now(),
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

              // O3：跳过近期已检查
              const lastCheck = cronKV
                ? await getLastChecked(user, source, id)
                : ((fav as any).save_time || 0);
              if (lastCheck && Date.now() - lastCheck < SKIP_WITHIN_6H) {
                totalSkippedRecent++;
                return;
              }

              const favDetail = await getDetail(source, id);
              if (!favDetail) {
                totalFailed++;
                return;
              }

              // O4：优先 vod_total
              const favEpisodeCount =
                favDetail.totalEpisodes && favDetail.totalEpisodes > 0
                  ? favDetail.totalEpisodes
                  : (favDetail.episodes?.length || 0);

              if (
                favEpisodeCount > 0 &&
                favEpisodeCount !== (fav as any).total_episodes
              ) {
                const originalEpisodes =
                  (fav as any).original_episodes || (fav as any).total_episodes;

                // O6：异常减少保护
                if (
                  originalEpisodes > 0 &&
                  favEpisodeCount < originalEpisodes &&
                  (originalEpisodes - favEpisodeCount) / originalEpisodes > 0.3
                ) {
                  cronLog(
                    `⚠ 收藏集数异常减少，跳过: ${(fav as any).title} (${(fav as any).total_episodes} -> ${favEpisodeCount}, 原始: ${originalEpisodes})`
                  );
                  await markChecked(user, source, id);
                  totalSkipped++;
                  return;
                }

                await db.saveFavorite(user, source, id, {
                  title: favDetail.title || (fav as any).title,
                  source_name: (fav as any).source_name,
                  cover: favDetail.poster || (fav as any).cover,
                  year: favDetail.year || (fav as any).year,
                  total_episodes: favEpisodeCount,
                  original_episodes: originalEpisodes, // O7：收藏也保留基线
                  save_time: Date.now(),
                  search_title: (fav as any).search_title,
                } as any);
                cronLog(
                  `✓ 更新收藏: ${(fav as any).title} (${(fav as any).total_episodes} -> ${favEpisodeCount})`
                );
                totalUpdated++;
              } else {
                // O3：集数未变，KV 记录检查时间；无 KV 时回退写 save_time
                await markChecked(user, source, id);
                if (!cronKV && (fav as any).save_time !== Date.now()) {
                  await db.saveFavorite(user, source, id, {
                    ...(fav as any),
                    save_time: Date.now(),
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
    report.skippedRecent = totalSkippedRecent;
    report.failed = totalFailed;
    report.kvCheckEnabled = !!cronKV; // O3：是否启用 KV 检查记录
    if (skippedSources.length > 0) {
      report.skippedSources = skippedSources;
    }
    cronLog(
      `完成: subrequest ${subrequestCount}次, 缓存 ${detailCache.size} 条, ` +
        `更新 ${totalUpdated} 条, 跳过(集数同) ${totalSkipped} 条, ` +
        `跳过(近期) ${totalSkippedRecent} 条, 失败 ${totalFailed} 条` +
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
