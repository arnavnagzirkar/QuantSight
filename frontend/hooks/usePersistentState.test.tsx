import { act, fireEvent, render, screen } from '@testing-library/react';

import { usePersistentState } from './usePersistentState';

function Harness() {
  const [value, setValue] = usePersistentState('test:persistent-state', { ticker: 'AAPL' });
  return (
    <button onClick={() => setValue({ ticker: 'MSFT' })}>
      {value.ticker}
    </button>
  );
}

describe('usePersistentState', () => {
  beforeEach(() => localStorage.clear());

  it('restores state after a component remount', () => {
    const firstRender = render(<Harness />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('MSFT');

    firstRender.unmount();
    render(<Harness />);

    expect(screen.getByRole('button')).toHaveTextContent('MSFT');
  });

  it('reacts to storage changes from another browser tab', () => {
    render(<Harness />);
    act(() => {
      localStorage.setItem('test:persistent-state', JSON.stringify({ ticker: 'GOOGL' }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'test:persistent-state' }));
    });

    expect(screen.getByRole('button')).toHaveTextContent('GOOGL');
  });

  it('returns to its default when another tab clears the value', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button'));

    act(() => {
      localStorage.removeItem('test:persistent-state');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'test:persistent-state',
        newValue: null,
      }));
    });

    expect(screen.getByRole('button')).toHaveTextContent('AAPL');
  });
});