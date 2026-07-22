import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import { useAuth } from '../contexts/AuthContext';

type InitialValue<T> = T | (() => T);
type SetValue<T> = T | ((current: T) => T);

const listeners = new Map<string, Set<() => void>>();
const memoryValues = new Map<string, string>();

function emit(storageKey: string) {
  listeners.get(storageKey)?.forEach(listener => listener());
}

function subscribe(storageKey: string, listener: () => void) {
  const keyListeners = listeners.get(storageKey) ?? new Set();
  keyListeners.add(listener);
  listeners.set(storageKey, keyListeners);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return;
    if (event.newValue === null) memoryValues.delete(storageKey);
    else memoryValues.set(storageKey, event.newValue);
    listener();
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('storage', handleStorage);
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(storageKey);
  };
}

function readRaw(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) ?? memoryValues.get(storageKey) ?? null;
  } catch {
    return memoryValues.get(storageKey) ?? null;
  }
}

function parseValue<T>(rawValue: string | null, fallback: T): T {
  if (rawValue === null) return fallback;
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(storageKey: string, initialValue: InitialValue<T>) {
  const initialValueRef = useRef<T>();
  if (initialValueRef.current === undefined) {
    initialValueRef.current = initialValue instanceof Function ? initialValue() : initialValue;
  }

  const subscribeToKey = useCallback(
    (listener: () => void) => subscribe(storageKey, listener),
    [storageKey],
  );
  const getSnapshot = useCallback(() => readRaw(storageKey), [storageKey]);
  const rawValue = useSyncExternalStore(subscribeToKey, getSnapshot, () => null);
  const value = useMemo(
    () => parseValue(rawValue, initialValueRef.current as T),
    [rawValue],
  );

  const setValue = useCallback((nextValue: SetValue<T>) => {
    const currentValue = parseValue(readRaw(storageKey), initialValueRef.current as T);
    const resolvedValue = nextValue instanceof Function ? nextValue(currentValue) : nextValue;
    const serializedValue = JSON.stringify(resolvedValue);
    memoryValues.set(storageKey, serializedValue);
    try {
      window.localStorage.setItem(storageKey, serializedValue);
    } catch {
      // The in-memory fallback remains active when browser storage is unavailable.
    }
    emit(storageKey);
  }, [storageKey]);

  const clearValue = useCallback(() => {
    memoryValues.delete(storageKey);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage access failures.
    }
    emit(storageKey);
  }, [storageKey]);

  return [value, setValue, clearValue] as const;
}

export function useUserPersistentState<T>(key: string, initialValue: InitialValue<T>) {
  const { user } = useAuth();
  const storageKey = `quantsight:v1:${user?.id ?? 'anonymous'}:${key}`;
  return usePersistentState(storageKey, initialValue);
}