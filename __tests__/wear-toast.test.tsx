import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { TOAST_MS, WearToast } from '@/components/wear-toast';

/**
 * §8.5 — the toast carries Undo and **expires with the toast**: Undo is the
 * mis-tap rescued in place, and once the timer fires it's gone.
 */
describe('wear toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires Undo when tapped', async () => {
    const onUndo = jest.fn();
    await render(<WearToast message="Logged a wear." onUndo={onUndo} onExpire={jest.fn()} />);

    fireEvent.press(screen.getByTestId('wear-toast-undo'));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('expires on its own after the timeout', async () => {
    const onExpire = jest.fn();
    await render(<WearToast message="Logged a wear." onUndo={jest.fn()} onExpire={onExpire} />);

    expect(onExpire).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(TOAST_MS);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
