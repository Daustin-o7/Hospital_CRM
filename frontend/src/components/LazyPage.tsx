import { lazy, Suspense, type ComponentType } from 'react';
import { SkeletonCard } from './ui/Skeleton';

interface LazyPageProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function LazyPage({ children, fallback }: LazyPageProps) {
  return (
    <Suspense fallback={fallback || <SkeletonCard />}>
      {children}
    </Suspense>
  )
}

export function createLazyPage<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn)
  return function LazyPageWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <SkeletonCard />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}