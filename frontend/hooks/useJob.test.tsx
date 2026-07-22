import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { jobAPI } from '../services/api';
import type { JobRecord } from '../types/api';
import { useJob } from './useJob';

vi.mock('../services/api', () => ({
  jobAPI: {
    getJob: vi.fn(),
    cancelJob: vi.fn(),
  },
}));

const runningJob: JobRecord = {
  id: 'job-id',
  job_type: 'backtest',
  status: 'running',
  progress_percent: 20,
};

function StatusHarness() {
  const { job } = useJob('job-id');
  return <div>{job?.status ?? 'loading'}</div>;
}

function CancelHarness() {
  const { cancel } = useJob('job-id');
  return <button onClick={() => { void cancel(); void cancel(); }}>Cancel</button>;
}

describe('useJob', () => {
  beforeEach(() => {
    vi.mocked(jobAPI.getJob).mockReset();
    vi.mocked(jobAPI.cancelJob).mockReset();
    vi.mocked(jobAPI.getJob).mockResolvedValue({ data: runningJob });
    vi.mocked(jobAPI.cancelJob).mockResolvedValue({
      data: { ...runningJob, status: 'cancel_requested' },
    });
  });

  it('coalesces simultaneous requests for the same job', async () => {
    const view = render(<><StatusHarness /><StatusHarness /></>);

    await waitFor(() => expect(screen.getAllByText('running')).toHaveLength(2));
    expect(jobAPI.getJob).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('coalesces repeated cancellation attempts', async () => {
    const view = render(<CancelHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(jobAPI.cancelJob).toHaveBeenCalledTimes(1));
    view.unmount();
  });
});