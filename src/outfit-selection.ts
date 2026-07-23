import type { Item } from './db/schema';

/**
 * §6.1.1 — a selected item **reorders to the front of its rail**. `selection` is
 * the tap-order list the whole builder shares; within one rail we surface its
 * selected items first, **latest tap frontmost**, then the unselected ones in
 * their original feed order.
 *
 * Pulled out as a pure function because "front of its rail" is the one piece of
 * builder behaviour with real ordering logic, and the AC pins it directly.
 */
export function frontLoadRail(items: Item[], selection: number[]): Item[] {
  const rank = new Map(selection.map((id, index) => [id, index]));
  const selected = items
    .filter((item) => rank.has(item.id))
    // Higher tap-index === more recently selected === closer to the front.
    .sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
  const rest = items.filter((item) => !rank.has(item.id));
  return [...selected, ...rest];
}
