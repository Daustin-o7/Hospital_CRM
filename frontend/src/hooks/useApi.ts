import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = unknown>(
  url: string,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const { immediate = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: unknown[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: args[0] });
      const result = res.data as T;
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error');
      setError(e);
      onError?.(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { data, loading, error, execute, reset };
}

export function useApiPost<T = unknown, B = unknown>(
  url: string,
  options: UseApiOptions<T> = {}
): UseApiResult<T> & { execute: (body: B) => Promise<T | null> } {
  const { immediate = false, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (body: B) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(url, body);
      const result = res.data as T;
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error');
      setError(e);
      onError?.(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute({} as B);
    }
  }, [execute, immediate]);

  // Fix type intersection issue
  return { data, loading, error, execute, reset } as UseApiResult<T> & { execute: (body: B) => Promise<T | null> };
}