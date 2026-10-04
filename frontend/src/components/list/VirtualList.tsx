import { useMemo, useRef, useState } from 'react';

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  keyExtractor: (item: T, index: number) => string
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  keyExtractor,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  const totalHeight = items.length * itemHeight
  const offsetY = Math.max(0, items.length > 0 ? Math.floor(scrollTop / itemHeight) * itemHeight : 0)

  return (
    <div
      ref={listRef}
      className="virtual-list"
      style={{ height: containerHeight, overflow: 'auto', position: 'relative' }}
      onScroll={handleScroll}
      role="list"
      aria-label="Virtualized list"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items
            .slice(visibleRange.startIndex, visibleRange.endIndex + 1)
            .map((item, i) => {
              const index = visibleRange.startIndex + i
              return (
                <div
                  key={keyExtractor(item, index)}
                  style={{
                    position: 'absolute',
                    top: index * itemHeight,
                    left: 0,
                    right: 0,
                    height: itemHeight,
                  }}
                >
                  {renderItem(item, index)}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}