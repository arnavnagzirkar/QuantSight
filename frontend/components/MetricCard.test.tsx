import { render, screen } from '@testing-library/react';
import { Activity } from 'lucide-react';

import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders the supported subtitle and icon contract', () => {
    const { container } = render(
      <MetricCard title="Sharpe Ratio" value="1.42" subtitle="Latest completed run" icon={Activity} />,
    );

    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
    expect(screen.getByText('1.42')).toBeInTheDocument();
    expect(screen.getByText('Latest completed run')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});