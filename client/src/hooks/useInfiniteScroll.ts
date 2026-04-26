import { useState, useEffect, useRef, useCallback } from 'react';

const BATCH_SIZE = 50;

export function useInfiniteScroll(totalCount: number) {
  const [displayCount, setDisplayCount] = useState(Math.min(BATCH_SIZE, totalCount));
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset display count when total changes significantly (e.g. filter/search)
  useEffect(() => {
    setDisplayCount(Math.min(BATCH_SIZE, totalCount));
  }, [totalCount]);

  const loadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + BATCH_SIZE, totalCount));
  }, [totalCount]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || displayCount >= totalCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [displayCount, totalCount, loadMore]);

  return { displayCount, sentinelRef };
}
