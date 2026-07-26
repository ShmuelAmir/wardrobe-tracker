import { StyleSheet, Text, View } from 'react-native';

import { ItemImage } from '@/components/item-image';
import { humanizeDaysAgo, daysSinceDate, daysSinceIso } from '@/relative-time';
import type { Item } from '@/db/schema';
import type { WornItem } from '@/db/queries';

/**
 * §9.5 Stats rows. A leaderboard row and a never-worn row share a thumbnail,
 * a name, and a `brand · <relative time>` sub-line but differ in their trailing
 * badge: the leaderboard shows the wear count, never-worn shows a `0` in the
 * **attention tone** — the two badges are the whole visual argument for why the
 * row is where it is.
 */

/** Shared square thumbnail — the §4.1 `contentFit: 'cover'` tile at row scale. */
function Thumbnail({ item }: { item: Item }) {
  return (
    <ItemImage
      item={item}
      style={styles.thumb}
      placeholderTextStyle={styles.placeholderLabel}
      testIDPrefix="stats-thumb"
    />
  );
}

/** `brand · <tail>`, dropping the brand cleanly when the item has none. */
function subline(brand: string | null, tail: string): string {
  return brand ? `${brand} · ${tail}` : tail;
}

/**
 * A leaderboard row (most- or least-worn). `rank` renders a leading position
 * number; the podium omits it (it carries rank in its own shape), the ranked
 * lists supply it.
 */
export function LeaderboardRow({
  item,
  rank,
  today,
}: {
  item: WornItem;
  rank?: number;
  today: Date;
}) {
  const worn = `worn ${humanizeDaysAgo(daysSinceIso(item.lastWorn, today))}`;
  return (
    <View style={styles.row} testID={`stats-leader-row-${item.id}`}>
      {rank !== undefined ? <Text style={styles.rank}>{rank}</Text> : null}
      <Thumbnail item={item} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name ?? item.category}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {subline(item.brand, worn)}
        </Text>
      </View>
      <View style={styles.countBadge} testID={`stats-wear-badge-${item.id}`}>
        <Text style={styles.countLabel}>{item.wearCount}</Text>
      </View>
    </View>
  );
}

/**
 * A never-worn row. **Always** carries the "added N ago" line (§9.5): it's what
 * makes the oldest-first sort legible — the year-old mistake at the top indicts
 * itself, this morning's purchase at the bottom explains itself. The `0` badge
 * is the attention tone, not the neutral leaderboard tone.
 */
export function NeverWornRow({ item, today }: { item: Item; today: Date }) {
  const added = `added ${humanizeDaysAgo(daysSinceDate(item.createdAt, today))}`;
  return (
    <View style={styles.row} testID={`stats-never-row-${item.id}`}>
      <Thumbnail item={item} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name ?? item.category}
        </Text>
        <Text style={styles.meta} numberOfLines={1} testID={`stats-added-${item.id}`}>
          {subline(item.brand, added)}
        </Text>
      </View>
      <View style={[styles.countBadge, styles.zeroBadge]} testID={`stats-zero-badge-${item.id}`}>
        <Text style={[styles.countLabel, styles.zeroLabel]}>0</Text>
      </View>
    </View>
  );
}

const THUMB = 52;

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  rank: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    opacity: 0.4,
    width: 18,
  },
  thumb: {
    backgroundColor: '#e9e6f0',
    borderRadius: 10,
    height: THUMB,
    width: THUMB,
  },
  placeholderLabel: {
    fontSize: 10,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    opacity: 0.55,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: '#eceaf2',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countLabel: {
    color: '#3a2a6d',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  zeroBadge: {
    backgroundColor: '#fbe4d6',
  },
  zeroLabel: {
    color: '#b5460f',
  },
});
