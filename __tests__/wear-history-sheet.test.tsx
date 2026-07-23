import { fireEvent, render, screen } from '@testing-library/react-native';

import { WearHistorySheet } from '@/components/wear-history-sheet';

/**
 * §8.5 — the durable un-log path: one dated row per event, each with Remove,
 * carrying its own event id so a single past wear can be un-logged.
 */
describe('wear history sheet', () => {
  it('renders one dated row per event, newest first as given', async () => {
    await render(
      <WearHistorySheet
        rows={[
          { id: 5, wornOn: '2026-07-20' },
          { id: 3, wornOn: '2026-07-14' },
        ]}
        onRemove={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('history-row-5')).toBeOnTheScreen();
    expect(screen.getByText('Jul 20, 2026')).toBeOnTheScreen();
    expect(screen.getByText('Jul 14, 2026')).toBeOnTheScreen();
  });

  it('removes exactly the event whose row was tapped', async () => {
    const onRemove = jest.fn();
    await render(
      <WearHistorySheet
        rows={[
          { id: 5, wornOn: '2026-07-20' },
          { id: 3, wornOn: '2026-07-14' },
        ]}
        onRemove={onRemove}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('history-remove-3'));

    expect(onRemove).toHaveBeenCalledWith(3);
  });

  it('shows an empty state when there are no wears', async () => {
    await render(<WearHistorySheet rows={[]} onRemove={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByTestId('history-empty')).toBeOnTheScreen();
  });
});
