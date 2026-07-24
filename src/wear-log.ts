import { eq } from 'drizzle-orm';

import { db } from './db/client';
import { wearEvent } from './db/schema';

/**
 * §8.5 — wear logging is the one thing a user does daily. A wear is one
 * `wear_event` row per log (§3), day-granular; these three functions are the
 * only writes to that table, shared by "Wore this today", the "Other day"
 * backfill, the toast Undo, and the history sheet's Remove.
 */

/**
 * Format a `Date` as a **local** `YYYY-MM-DD`. Day-granular and local on
 * purpose: "today" is the user's calendar day, not UTC's, so a late-evening log
 * doesn't jump to tomorrow. Takes an explicit date so callers and tests pin it.
 */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as a local `YYYY-MM-DD` — the day "Wore this today" writes. */
export function isoToday(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * Write one wear event for `outfitId` on `wornOn` and return its row id. The id
 * is what the toast's Undo holds onto so it can delete **exactly that tap**, not
 * "the latest wear for this outfit" — two same-day logs are distinct events.
 */
export function logWear(outfitId: number, wornOn: string): number {
  return db
    .insert(wearEvent)
    .values({ outfitId, wornOn })
    .returning({ id: wearEvent.id })
    .get().id;
}

/** Delete one wear event by id — the shared un-log path (§8.5). */
export function removeWear(eventId: number): void {
  db.delete(wearEvent).where(eq(wearEvent.id, eventId)).run();
}
