import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { JobRecord } from '../types/api';

interface JobHistorySelectProps {
  jobs: JobRecord[];
  label: string;
  value: string | null;
  onValueChange: (jobId: string) => void;
}

export function JobHistorySelect({ jobs, label, value, onValueChange }: JobHistorySelectProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="max-w-md space-y-2">
      <Label>{label}</Label>
      <Select value={value ?? undefined} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a saved run" />
        </SelectTrigger>
        <SelectContent>
          {jobs.map(job => (
            <SelectItem key={job.id} value={job.id}>
              {jobName(job)} · {job.status.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function jobName(job: JobRecord) {
  const summary = job.result_summary;
  if (summary && 'name' in summary && typeof summary.name === 'string') {
    return summary.name;
  }
  const parameterName = job.params?.name;
  if (typeof parameterName === 'string') return parameterName;
  return job.job_type.replace(/_/g, ' ');
}