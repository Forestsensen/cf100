'use client';

export interface BangumiCalendarData {
  weekday: {
    en: string;
  };
  items: {
    id: number;
    name: string;
    name_cn: string;
    rating: {
      score: number;
    };
    air_date: string;
    images: {
      large: string;
      common: string;
      medium: string;
      small: string;
      grid: string;
    };
  }[];
}

export async function GetBangumiCalendarData(): Promise<BangumiCalendarData[]> {
  const response = await fetch('/api/bangumi/calendar');
  if (!response.ok) {
    throw new Error("获取番剧日历失败: HTTP " + response.status);
  }
  const data = await response.json();
  // B2(100.0.1): 数据格式异常（非数组 / item.items 缺失）时直接返回空，避免首页崩溃
  if (!Array.isArray(data)) {
    console.warn('[番剧日历] 返回数据格式异常，已忽略');
    return [];
  }
  const filteredData = data
    .filter((item: BangumiCalendarData) => item && Array.isArray(item.items))
    .map((item: BangumiCalendarData) => ({
      ...item,
      // 仅保留确有封面图的条目，避免空图占位导致渲染异常
      items: item.items.filter((bangumiItem) => bangumiItem?.images?.large),
    }));

  return filteredData;
}
