import { useEffect, useMemo, useState } from 'react';

import { jobAPI } from '../services/api';
import type { JobRecord } from '../types/api';
import { useJob } from './useJob';
import { useUserPersistentState } from './usePersistentState';

export function useRestorableJob(storageKey: string, jobTypes: string | string[]) {
  const typeSignature = Array.isArray(jobTypes)
    ? [...jobTypes].sort().join(',')
    : jobTypes;
  const acceptedTypes = useMemo(
    () => new Set(typeSignature.split(',')),
    [typeSignature],
  );
  const [jobId, setJobId, clearJobId] = useUserPersistentState<string | null>(
    `${storageKey}:job-id`,
    null,
  );
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [restoring, setRestoring] = useState(true);
  const jobState = useJob(jobId);

  useEffect(() => {
    let active = true;
    setRestoring(true);
    jobAPI.listJobs(100)
      .then(response => {
        if (!active) return;
        const matchingJobs = response.data.filter(job => acceptedTypes.has(job.job_type));
        setHistory(matchingJobs);
        if (matchingJobs[0]) {
          setJobId(currentJobId => currentJobId ?? matchingJobs[0].id);
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });

    return () => {
      active = false;
    };
  }, [acceptedTypes, setJobId, typeSignature]);

  useEffect(() => {
    if (!jobState.job) return;
    setHistory(current => [
      jobState.job as JobRecord,
      ...current.filter(item => item.id !== jobState.job?.id),
    ]);
  }, [jobState.job]);

  return {
    ...jobState,
    jobId,
    setJobId,
    clearJobId,
    history,
    restoring,
  };
}