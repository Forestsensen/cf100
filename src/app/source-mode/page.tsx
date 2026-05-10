/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';
import VirtualGrid from '@/components/VirtualGrid';

interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

interface SourceClass {
  type_id: string | number;
  type_pid?: string | number;
  type_name: string;
}

interface SourceModeResponse {
  class: SourceClass[];
  list?: SourceModeItem[];
  results?: SourceModeItem[];
  page: number;
  pagecount: number;
}

interface SourceModeItem {
  vod_id?: string | number;
  vod_name?: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_year?: string;
  type_name?: string;
  id?: string;
  title?: string;
  poster?: string;
  episodes?: number;
  year?: string;
}

interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
}

interface SourceModeSnapshot {
  selectedSource: string;
  selectedTop: string;
  selectedChild: string;
  classes: SourceClass[];
  items: SourceModeItem[];
  currentPage: number;
  hasMore: boolean;
  scrollY: number;
}

const skeletonData = Array.from({ length: 25 }, (_, index) => index);
const SNAPSHOT_KEY = 'source-mode-snapshot-v1';

function SourceModePageClient() {
  const [sources, setSources] = useState<ApiSite[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [classes, setClasses] = useState<SourceClass[]>([]);
  const [selectedTop, setSelectedTop] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const [items, setItems] = useState<SourceModeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const shouldSkipInitialReloadRef = useRef(false);
  const restoredSourceRef = useRef('');

  const categoryTree = useMemo<CategoryNode[]>(() => {
    const nodes = classes.map((item) => ({
      id: item.type_id.toString(),
      pid: item.type_pid?.toString() || '0',
      name: item.type_name,
    }));
    const idSet = new Set(nodes.map((item) => item.id));
    const topNodes = nodes.filter(
      (item) => item.pid === '0' || !idSet.has(item.pid)
    );

    return topNodes.map((top) => ({
      id: top.id,
      name: top.name,
      children: nodes
        .filter((item) => item.pid === top.id)
        .map((child) => ({
          id: child.id,
          name: child.name,
          children: [],
        })),
    }));
  }, [classes]);

  const selectedTopNode = categoryTree.find((item) => item.id === selectedTop);
  const activeTypeId = selectedChild || selectedTop || '';
  const selectedSourceName =
    sources.find((source) => source.key === selectedSource)?.name || '当前源';

  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch('/api/search/resources');
      if (!response.ok) throw new Error('获取源列表失败');
      const data = await response.json();
      const sourceList = Array.isArray(data) ? data : [];
      setSources(sourceList);
      setSelectedSource((prev) => {
        if (prev && sourceList.some((item) => item.key === prev)) {
          return prev;
        }
        return sourceList[0]?.key || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取源列表失败');
    }
  }, []);

  const fetchSourceData = useCallback(
    async (page: number, append = false, typeId = activeTypeId) => {
      if (!selectedSource) return;
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      if (!append) {
        requestAbortRef.current?.abort();
      }
      const controller = new AbortController();
      requestAbortRef.current = controller;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }

      try {
        const params = new URLSearchParams({
          source: selectedSource,
          page: page.toString(),
        });
        if (typeId) params.set('typeId', typeId);
        const response = await fetch(`/api/source-mode?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('加载资源失败');
        const data = (await response.json()) as SourceModeResponse;
        if (requestSeq !== requestSeqRef.current) return;

        const nextItems = Array.isArray(data.list)
          ? data.list
          : Array.isArray(data.results)
          ? data.results
          : [];

        if (data.class?.length > 0) {
          setClasses(data.class);
        }
        setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
        setCurrentPage(data.page || page);
        // 第一页无数据时，直接判定无更多页面，避免继续请求第二页
        if (!append && page === 1 && nextItems.length === 0) {
          setHasMore(false);
        } else {
          setHasMore((data.page || page) < (data.pagecount || 1));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '加载资源失败');
        if (!append) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [selectedSource, activeTypeId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as SourceModeSnapshot;
      if (!snapshot?.selectedSource) return;
      setSelectedSource(snapshot.selectedSource);
      setSelectedTop(snapshot.selectedTop || '');
      setSelectedChild(snapshot.selectedChild || '');
      setClasses(Array.isArray(snapshot.classes) ? snapshot.classes : []);
      setItems(Array.isArray(snapshot.items) ? snapshot.items : []);
      setCurrentPage(
        Number(snapshot.currentPage) > 0 ? snapshot.currentPage : 1
      );
      setHasMore(Boolean(snapshot.hasMore));
      restoredSourceRef.current = snapshot.selectedSource;
      shouldSkipInitialReloadRef.current = true;
      if ((snapshot.scrollY || 0) > 0) {
        requestAnimationFrame(() => window.scrollTo(0, snapshot.scrollY || 0));
      }
    } catch {
      // ignore invalid snapshot
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (!selectedSource) return;
    if (
      shouldSkipInitialReloadRef.current &&
      restoredSourceRef.current === selectedSource
    ) {
      shouldSkipInitialReloadRef.current = false;
      return;
    }
    setSelectedTop('');
    setSelectedChild('');
    setClasses([]);
    fetchSourceData(1, false, '');
  }, [selectedSource]);

  useEffect(() => {
    if (!loadingRef.current || !hasMore || loading || isLoadingMore) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
        fetchSourceData(currentPage + 1, true);
      }
    });
    observerRef.current.observe(loadingRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, isLoadingMore, currentPage, fetchSourceData]);

  const handleSourceChange = (source: string) => {
    if (source === selectedSource) return;
    setSelectedSource(source);
  };

  const handleTopChange = (typeId: string) => {
    if (typeId === selectedTop && !selectedChild) return;
    const targetTop = categoryTree.find((item) => item.id === typeId);
    const defaultChild = targetTop?.children[0]?.id || '';
    setSelectedTop(typeId);
    setSelectedChild(defaultChild);
    fetchSourceData(1, false, defaultChild || typeId);
  };

  const handleChildChange = (typeId: string) => {
    if (typeId === selectedChild) return;
    setSelectedChild(typeId);
    fetchSourceData(1, false, typeId || selectedTop);
  };

  useEffect(() => {
    if (!selectedSource || selectedTop || categoryTree.length === 0) return;
    const firstCategory = categoryTree[0];
    const firstChild = firstCategory.children[0]?.id || '';
    setSelectedTop(firstCategory.id);
    setSelectedChild(firstChild);
    fetchSourceData(1, false, firstChild || firstCategory.id);
  }, [selectedSource, selectedTop, categoryTree, fetchSourceData]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedSource) return;
    const snapshot: SourceModeSnapshot = {
      selectedSource,
      selectedTop,
      selectedChild,
      classes,
      items,
      currentPage,
      hasMore,
      scrollY: window.scrollY || 0,
    };
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  }, [
    selectedSource,
    selectedTop,
    selectedChild,
    classes,
    items,
    currentPage,
    hasMore,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedSource) return;
    const onScroll = () => {
      try {
        const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
        if (!raw) return;
        const snapshot = JSON.parse(raw) as SourceModeSnapshot;
        snapshot.scrollY = window.scrollY || 0;
        window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [selectedSource]);

  const renderSelector = (
    label: string,
    options: Array<{ label: string; value: string }>,
    activeValue: string,
    onChange: (value: string) => void,
    wrap = false
  ) => (
    <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
      <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
        {label}
      </span>
      <div className={wrap ? '' : 'overflow-x-auto'}>
        <div
          className={`relative bg-gray-200/60 rounded-2xl p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm ${
            wrap
              ? 'inline-flex flex-wrap gap-1 sm:gap-2 max-w-full'
              : 'inline-flex'
          }`}
        >
          {options.map((option) => {
            const active = option.value === activeValue;
            return (
              <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                  active
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-500 dark:text-gray-100'
                    : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout activePath='/source-mode'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
              源模式
            </h1>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              来自{selectedSourceName}的内容
            </p>
          </div>

          <div className='bg-white/60 dark:bg-gray-800/40 rounded-2xl p-4 sm:p-6 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm'>
            <div className='space-y-4 sm:space-y-6'>
              {renderSelector(
                '源',
                sources.map((source) => ({
                  label: source.name,
                  value: source.key,
                })),
                selectedSource,
                handleSourceChange,
                true
              )}

              {categoryTree.length > 0 &&
                renderSelector(
                  '分类',
                  categoryTree.map((item) => ({
                    label: item.name,
                    value: item.id,
                  })),
                  selectedTop,
                  handleTopChange,
                  true
                )}

              {selectedTopNode &&
                selectedTopNode.children.length > 0 &&
                renderSelector(
                  '类型',
                  [
                    { label: '全部', value: '' },
                    ...selectedTopNode.children.map((item) => ({
                      label: item.name,
                      value: item.id,
                    })),
                  ],
                  selectedChild,
                  handleChildChange,
                  true
                )}
            </div>
          </div>
        </div>

        <div className='max-w-[95%] mx-auto mt-8 overflow-visible'>
          {error && (
            <div className='mb-6 text-sm text-red-600 dark:text-red-400'>
              {error}
            </div>
          )}

          {loading ? (
            <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
              {skeletonData.map((item) => (
                <DoubanCardSkeleton key={item} />
              ))}
            </div>
          ) : items.length > 0 ? (
            <VirtualGrid
              items={items}
              estimateRowHeight={320}
              rowGapClass='pb-12 sm:pb-20'
              className='grid-cols-3 gap-x-2 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8'
              renderItem={(item) => (
                <VideoCard
                  id={(item.vod_id ?? item.id ?? '').toString()}
                  title={item.vod_name || item.title || ''}
                  poster={item.vod_pic || item.poster || ''}
                  source={selectedSource}
                  source_name={selectedSourceName}
                  episodes={item.episodes ?? (item.vod_remarks ? 1 : undefined)}
                  year={
                    item.vod_year?.match(/\d{4}/)?.[0] ||
                    item.year?.match(/\d{4}/)?.[0] ||
                    ''
                  }
                  from='search'
                  type=''
                />
              )}
            />
          ) : (
            <div className='text-center text-gray-500 dark:text-gray-400 py-8'>
              暂无资源
            </div>
          )}

          <div ref={loadingRef} className='flex justify-center mt-12 py-8'>
            {isLoadingMore && (
              <div className='flex items-center gap-2'>
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'></div>
                <span className='text-gray-600'>加载中...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function SourceModePage() {
  return (
    <Suspense>
      <SourceModePageClient />
    </Suspense>
  );
}
