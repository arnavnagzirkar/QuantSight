import { render, screen } from '@testing-library/react';

import { CorrelationHeatmap } from './CorrelationHeatmap';
import { EquityCurveChart } from './EquityCurveChart';
import { LongShortEquityChart } from './LongShortEquityChart';

describe('data charts', () => {
  it('renders honest empty states when no result exists', () => {
    render(
      <>
        <EquityCurveChart />
        <CorrelationHeatmap />
        <LongShortEquityChart />
      </>,
    );

    expect(screen.getByText('No equity data available')).toBeInTheDocument();
    expect(screen.getByText('No correlation data available')).toBeInTheDocument();
    expect(screen.getByText('No long/short equity data available')).toBeInTheDocument();
  });
});