'use client';

/**
 * 追番更新检查 Hook
 *
 * 功能：
 * - 实时检查用户观看过的剧集是否有新集数更新
 * - 对比 original_episodes 和 API 最新集数
 * - 用于在首页显示"有新集"提示
 *
 * 工作原理：
 * 1. 获取所有播放记录
 * 2. 并发检查每个剧集的最新集数
 * 3. 对比 original_episodes，判断是否有更新
 */

import { useCallback, useEffect, useState } from 'react';

import { PlayRecord } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface WatchingUpdate {
  hasUpdates: boolean;
  updatedCount: number;
  updatedSeries: {
    title: string;
    source_name: string;
    year: string;
    cover: string;
    sourceKey: string;
    videoId: string;
    currentEpisode: number;
    totalEpisodes: number;
    originalEpisodes: number;
    latestEpisodes: number;
    newEpisodes: number;
  }[];
}

// ============================================================================
// Constants
// ============================================================================

// 10分钟缓存（与 ergTV 一致）
const CACHE_KEY = 'cf100_watching_updates';
const CACHE_DURATION = 10 * 60 * 1000; // 10分钟

// ============================================================================
// Hook
// ============================================================================

export function useWatchingUpdates() {
  const [updates, setUpdates] = useState<WatchingUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<number>(0);

  // 从缓存读取
  const getCachedUpdates = useCallback((): WatchingUpdate | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.timestamp && Date.now() - data.timestamp < CACHE_DURATION) {
          return data.updates;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  // 保存到缓存
  const setCachedUpdates = useCallback((updates: WatchingUpdate) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        updates,
        timestamp: Date.now(),
      }));
    } catch {
      // ignore
    }
  }, []);

  // 检查单个剧集的更新
  const checkSingleUpdate = useCallback(async (
    record: PlayRecord & { key: string },
  ): Promise<WatchingUpdate['updatedSeries'][0] | null> => {
    try {
      const [sourceName, videoId] = record.key.split('+');
      if (!sourceName || !videoId) return null;

      // 调用详情 API（使用10分钟分片缓存，减少请求）
      const cacheKey = Math.floor(Date.now() / 600000) * 600000;
      const response = await fetch(`/api/detail?source=${sourceName}&id=${videoId}&_t=${cacheKey}`, {
        cache: 'no-store',
      });

      if (!response.ok) return null;

      const detailData = await response.json();
      const latestEpisodes = detailData.episodes?.length || 0;

      if (latestEpisodes === 0) return null;

      // 获取原始集数（追番基线）
      let originalEpisodes = record.original_episodes || record.total_episodes;

      // O12: 数据写坏时 original_episodes 可能大于 total_episodes，
      // 会导致永远判定为「无更新」而卡死，纠正为 total_episodes
      if (record.total_episodes && originalEpisodes > record.total_episodes) {
        originalEpisodes = record.total_episodes;
      }

      // O11: 源站/CDN 偶发返回更少集数时，取三者最大值作为有效最新集数，
      // 避免误判「无更新」或卡片数字跳变
      const effectiveLatest = Math.max(
        latestEpisodes,
        originalEpisodes,
        record.total_episodes || 0
      );

      // 调试日志
      console.log(`[追番更新] ${record.title}: API=${latestEpisodes}, 有效=${effectiveLatest}, 原始=${originalEpisodes}, 播放记录=${record.total_episodes}`);

      // 检查是否有新集数
      if (effectiveLatest > originalEpisodes) {
        const newEpisodes = effectiveLatest - originalEpisodes;
        console.log(`[追番更新] ✨ ${record.title} 有新集: ${originalEpisodes} -> ${effectiveLatest} (+${newEpisodes})`);
        return {
          title: record.title,
          source_name: record.source_name,
          year: record.year,
          cover: record.cover,
          sourceKey: sourceName,
          videoId,
          currentEpisode: record.index,
          totalEpisodes: effectiveLatest,
          originalEpisodes,
          latestEpisodes: effectiveLatest,
          newEpisodes,
        };
      }

      return null;
    } catch (error) {
      console.error(`[追番更新] ${record.title} 检查失败:`, error);
      return null;
    }
  }, []);

  // 检查所有更新
  const checkUpdates = useCallback(async (force = false) => {
    // 检查缓存
    if (!force) {
      const cached = getCachedUpdates();
      if (cached) {
        console.log('[追番更新] 使用缓存数据');
        setUpdates(cached);
        return;
      }
    }

    console.log('[追番更新] 开始检查更新...');
    setLoading(true);
    try {
      // 获取播放记录
      const response = await fetch('/api/playrecords');
      if (!response.ok) {
        console.error('[追番更新] 获取播放记录失败:', response.status);
        setLoading(false);
        return;
      }

      const records = await response.json() as Record<string, PlayRecord>;
      const entries = Object.entries(records)
        .map(([key, record]) => ({ ...record, key }))
        .filter(r => r.total_episodes > 1); // 只检查多集剧

      console.log(`[追番更新] 找到 ${entries.length} 个多集剧待检查`);

      if (entries.length === 0) {
        const emptyResult: WatchingUpdate = {
          hasUpdates: false,
          updatedCount: 0,
          updatedSeries: [],
        };
        setUpdates(emptyResult);
        setCachedUpdates(emptyResult);
        setLoading(false);
        return;
      }

      // 并发检查（限制并发数为 5）
      const results: WatchingUpdate['updatedSeries'] = [];
      const CONCURRENT = 5;

      for (let i = 0; i < entries.length; i += CONCURRENT) {
        const batch = entries.slice(i, i + CONCURRENT);
        const batchResults = await Promise.all(
          batch.map(record => checkSingleUpdate(record))
        );
        results.push(...batchResults.filter(Boolean) as WatchingUpdate['updatedSeries']);
      }

      // O13: 按标题稳定排序，避免并发检测完成顺序不定导致卡片重排闪烁
      results.sort((a, b) => a.title.localeCompare(b.title, 'zh'));

      const result: WatchingUpdate = {
        hasUpdates: results.length > 0,
        updatedCount: results.length,
        updatedSeries: results,
      };

      console.log(`[追番更新] 检查完成: ${result.updatedCount} 个有新集`);
      setUpdates(result);
      setCachedUpdates(result);
      setLastCheck(Date.now());
    } catch (error) {
      console.error('[追番更新] 检查失败:', error);
    } finally {
      setLoading(false);
    }
  }, [getCachedUpdates, setCachedUpdates, checkSingleUpdate]);

  // 初始化：从缓存读取，然后后台检查
  useEffect(() => {
    const cached = getCachedUpdates();
    if (cached) {
      setUpdates(cached);
    }

    // 后台检查（不阻塞 UI）
    checkUpdates();
  }, [getCachedUpdates, checkUpdates]);

  return {
    updates,
    loading,
    lastCheck,
    refresh: () => checkUpdates(true),
  };
}
