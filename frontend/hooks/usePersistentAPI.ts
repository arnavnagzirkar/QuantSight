import { useCallback } from 'react';

import { useAPI } from './useAPI';
import { useUserPersistentState } from './usePersistentState';

export function usePersistentAPI<T>(
  storageKey: string,
  apiFunction: (...args: any[]) => Promise<T>,
) {
  const {
    data,
    loading,
    error,
    execute: executeRequest,
    reset: resetRequest,
  } = useAPI<T>(apiFunction);
  const [persistedData, setPersistedData, clearPersistedData] =
    useUserPersistentState<T | null>(`${storageKey}:result`, null);

  const execute = useCallback(async (...args: any[]) => {
    const result = await executeRequest(...args);
    if (result !== undefined) setPersistedData(result);
    return result;
  }, [executeRequest, setPersistedData]);

  const reset = useCallback(() => {
    resetRequest();
    clearPersistedData();
  }, [clearPersistedData, resetRequest]);

  return {
    data: data ?? persistedData,
    loading,
    error,
    execute,
    reset,
  };
}