import { SearchResult } from '@/lib/types';

// 缓存状态类型
export type CachedPageStatus = 'ok' | 'timeout' | 'forbidden';

// 缓存条目接口
export interface CachedPageEntry {
  expiresAt: number;
  status: CachedPageStatus;
  data: SearchResult[];
  pageCount?: number; // 仅第一页可选存储
}

// 缓存配置
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000; // 10分钟

// 缓存命名空间（使用伪造 host 作为 Cache API key 的 URL，跨 isolate 共享）
const CACHE_KEY_PREFIX = 'https://search-cache.internal/';

/**
 * 生成搜索缓存键：source + query + page
 */
function makeSearchCacheKey(sourceKey: string, query: string, page: number): string {
  return `${CACHE_KEY_PREFIX}${sourceKey}::${query.trim()}::${page}`;
}

/**
 * 获取缓存的搜索页面数据（caches.default 跨 edge isolate 共享）
 */
export async function getCachedSearchPage(
  sourceKey: string,
  query: string,
  page: number
): Promise<CachedPageEntry | null> {
  try {
    // @ts-expect-error caches.default is valid in Cloudflare Workers runtime
    const cache = (caches as { default: Cache }).default;
    const key = makeSearchCacheKey(sourceKey, query, page);
    const cached = await cache.match(key);
    if (!cached) return null;

    const entry = (await cached.json()) as CachedPageEntry;
    // 手动校验过期（Cache API match 不自动判新鲜度）
    if (entry.expiresAt <= Date.now()) {
      await cache.delete(key).catch(() => { /* ignore delete failure */ });
      return null;
    }
    return entry;
  } catch {
    // 缓存读取失败不影响主流程
    return null;
  }
}

/**
 * 设置缓存的搜索页面数据（caches.default 持久化，自动 LRU 淘汰）
 */
export async function setCachedSearchPage(
  sourceKey: string,
  query: string,
  page: number,
  status: CachedPageStatus,
  data: SearchResult[],
  pageCount?: number
): Promise<void> {
  try {
    // @ts-expect-error caches.default is valid in Cloudflare Workers runtime
    const cache = (caches as { default: Cache }).default;
    const key = makeSearchCacheKey(sourceKey, query, page);
    const entry: CachedPageEntry = {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      status,
      data,
      pageCount,
    };
    const response = new Response(JSON.stringify(entry), {
      headers: {
        'Content-Type': 'application/json',
        // 让 CF 也能按此 TTL 自然淘汰
        'Cache-Control': `public, max-age=${SEARCH_CACHE_TTL_MS / 1000}`,
      },
    });
    await cache.put(key, response);
  } catch {
    // 缓存写入失败不影响主流程
  }
}
