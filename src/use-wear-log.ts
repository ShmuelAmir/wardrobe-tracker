import { useCallback, useState } from 'react';

import { isoToday, logWear, removeWear } from '@/wear-log';

/** The just-logged wear, held while its Undo toast is up. */
export type LoggedWear = { eventId: number; outfitId: number };

/**
 * §2/§8.5 — the shared wear-log-with-Undo controller. Outfit Detail and the
 * Outfits "Wear again" rail both drive their toast from this one hook, so
 * "log a wear, then Undo exactly that tap" is *literally the same code* on both
 * surfaces rather than two copies that can drift.
 *
 * It owns the id of the event just written — Undo deletes **that tap**, not "the
 * latest wear for this outfit" (two same-day logs are distinct events, §8.5) —
 * plus the `outfitId` a caller uses to mark which card is mid-log. The 4s timer
 * and its expiry live in `wear-toast.tsx`; this hook only exposes `dismiss` for
 * the parent to call when the toast fires `onExpire`.
 */
export function useWearLog() {
  const [logged, setLogged] = useState<LoggedWear | null>(null);

  const log = useCallback((outfitId: number, wornOn: string) => {
    const eventId = logWear(outfitId, wornOn);
    setLogged({ eventId, outfitId });
  }, []);

  const logToday = useCallback((outfitId: number) => log(outfitId, isoToday()), [log]);

  // Functional update so undo always deletes the currently-held event, never a
  // stale closure's — the un-log path (§8.5).
  const undo = useCallback(() => {
    setLogged((current) => {
      if (current) removeWear(current.eventId);
      return null;
    });
  }, []);

  // The toast expired: drop the marker without un-logging. Once it's gone,
  // un-logging moves to the durable history-sheet path (§8.5).
  const dismiss = useCallback(() => setLogged(null), []);

  return { logged, log, logToday, undo, dismiss };
}
