import { act, renderHook } from '@testing-library/react-native';

import { useWearLog } from '@/use-wear-log';

const mockLogWear = jest.fn();
const mockRemoveWear = jest.fn();
jest.mock('@/wear-log', () => ({
  logWear: (...args: unknown[]) => mockLogWear(...args),
  removeWear: (...args: unknown[]) => mockRemoveWear(...args),
  isoToday: () => '2026-07-24',
}));

beforeEach(() => jest.clearAllMocks());

/**
 * §2/§8.5 — the one wear-log-with-Undo controller, shared verbatim by outfit
 * Detail and the Outfits rail so "log a wear, then Undo it" is literally one code
 * path on both surfaces. The hook owns the just-written event id (what Undo
 * deletes) and the transient `logged` marker; the timer/dismissal lives in the
 * toast the parent renders off `logged`.
 */
describe('useWearLog', () => {
  it('logs today, exposing the written event id and outfit as `logged`', async () => {
    mockLogWear.mockReturnValue(99);
    const { result } = await renderHook(() => useWearLog());

    await act(async () => {
      result.current.logToday(7);
    });

    expect(mockLogWear).toHaveBeenCalledWith(7, '2026-07-24');
    expect(result.current.logged).toEqual({ eventId: 99, outfitId: 7 });
  });

  it('logs an arbitrary day for the Detail backfill path', async () => {
    mockLogWear.mockReturnValue(42);
    const { result } = await renderHook(() => useWearLog());

    await act(async () => {
      result.current.log(7, '2026-01-01');
    });

    expect(mockLogWear).toHaveBeenCalledWith(7, '2026-01-01');
    expect(result.current.logged).toEqual({ eventId: 42, outfitId: 7 });
  });

  it('undo deletes exactly the event just written and clears `logged`', async () => {
    mockLogWear.mockReturnValue(99);
    const { result } = await renderHook(() => useWearLog());

    await act(async () => {
      result.current.logToday(7);
    });
    await act(async () => {
      result.current.undo();
    });

    expect(mockRemoveWear).toHaveBeenCalledWith(99);
    expect(result.current.logged).toBeNull();
  });

  it('dismiss clears `logged` without un-logging (the toast just expired)', async () => {
    mockLogWear.mockReturnValue(99);
    const { result } = await renderHook(() => useWearLog());

    await act(async () => {
      result.current.logToday(7);
    });
    await act(async () => {
      result.current.dismiss();
    });

    expect(mockRemoveWear).not.toHaveBeenCalled();
    expect(result.current.logged).toBeNull();
  });
});
