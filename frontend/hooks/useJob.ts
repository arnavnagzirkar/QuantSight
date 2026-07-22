import { useCallback, useEffect, useRef, useState } from 'react';

import { jobAPI } from '../services/api';
import type { JobRecord } from '../types/api';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const inFlightRequests = new Map<string, Promise<JobRecord>>();

function fetchJob(jobId: string) {
  const existing = inFlightRequests.get(jobId);
  if (existing) return existing;
  const request = jobAPI.getJob(jobId)
    .then(response => response.data)
    .finally(() => inFlightRequests.delete(jobId));
  inFlightRequests.set(jobId, request);
  return request;
}

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const cancelRequestRef = useRef<Promise<void> | null>(null);

  const publish = useCallback((nextJob: JobRecord) => {
    channelRef.current?.postMessage(nextJob);
  }, []);

  const refresh = useCallback(async () => {
    if (!jobId) return null;
    try {
      const nextJob = await fetchJob(jobId);
      setJob(nextJob);
      setError(null);
      publish(nextJob);
      return nextJob;
    } catch (refreshError) {
      const normalized = refreshError instanceof Error ? refreshError : new Error('Unable to load job');
      setError(normalized);
      return null;
    }
  }, [jobId, publish]);

  useEffect(() => {
    if (!jobId || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('quantsight:jobs');
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<JobRecord>) => {
      if (event.data?.id === jobId) {
        setJob(event.data);
        setError(null);
      }
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, [jobId]);

  useEffect(() => {
    setJob(null);
    setError(null);
    if (!jobId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(poll, 5000);
        return;
      }
      const current = await refresh();
      if (!current || !TERMINAL_STATUSES.has(current.status)) {
        timer = setTimeout(poll, current?.status === 'queued' ? 3000 : 2000);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      void poll();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [jobId, refresh]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    if (cancelRequestRef.current) return cancelRequestRef.current;
    cancelRequestRef.current = jobAPI.cancelJob(jobId)
      .then(response => {
        setJob(response.data);
        publish(response.data);
      })
      .finally(() => {
        cancelRequestRef.current = null;
      });
    return cancelRequestRef.current;
  }, [jobId, publish]);

  return { job, error, refresh, cancel };
}