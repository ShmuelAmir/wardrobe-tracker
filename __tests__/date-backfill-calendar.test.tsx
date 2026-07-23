import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { DateBackfillCalendar } from '@/components/date-backfill-calendar';

/**
 * §8.5 "Other day" — a calendar that **permits past dates and disables future
 * ones**. `today` is pinned to 2026-07-23 so the boundary is exact.
 */
describe('date backfill calendar', () => {
  const today = new Date(2026, 6, 23);

  it('picks a past date and emits its local YYYY-MM-DD', async () => {
    const onPick = jest.fn();
    await render(<DateBackfillCalendar today={today} onPick={onPick} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('calendar-day-2026-07-10'));

    expect(onPick).toHaveBeenCalledWith('2026-07-10');
  });

  it('permits today itself', async () => {
    const onPick = jest.fn();
    await render(<DateBackfillCalendar today={today} onPick={onPick} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('calendar-day-2026-07-23'));

    expect(onPick).toHaveBeenCalledWith('2026-07-23');
  });

  it('disables future days — pressing tomorrow does nothing', async () => {
    const onPick = jest.fn();
    await render(<DateBackfillCalendar today={today} onPick={onPick} onCancel={jest.fn()} />);

    const tomorrow = screen.getByTestId('calendar-day-2026-07-24');
    expect(tomorrow).toBeDisabled();
    fireEvent.press(tomorrow);

    expect(onPick).not.toHaveBeenCalled();
  });

  it('cannot page past the current month', async () => {
    await render(<DateBackfillCalendar today={today} onPick={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId('calendar-next')).toBeDisabled();
  });

  it('pages back to reach an earlier month, then picks a day there', async () => {
    const onPick = jest.fn();
    const user = userEvent.setup();
    await render(<DateBackfillCalendar today={today} onPick={onPick} onCancel={jest.fn()} />);

    await user.press(screen.getByTestId('calendar-prev'));
    expect(screen.getByText('June 2026')).toBeOnTheScreen();

    await user.press(screen.getByTestId('calendar-day-2026-06-15'));
    expect(onPick).toHaveBeenCalledWith('2026-06-15');
  });
});
