import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { WornItem } from '@/db/queries';
import { itemImageUri } from '@/item-images';

/**
 * §9.4 — the most-worn podium: the top three in **2–1–3** order (silver left,
 * gold center-raised, bronze right), with a "Favorite" tag on #1. It renders
 * only at `k ≥ 3` and is **a view of the capped `mostWorn` slice** — never a
 * fixed three-of-`worn` — so a card the cap excluded can't appear here while
 * also sitting in the least-worn list below (§9.2's both-lists collision).
 *
 * The owning screen passes exactly `mostWorn.slice(0, 3)`; ordering it 2–1–3 is
 * this component's job.
 */
export function StatsPodium({ top }: { top: WornItem[] }) {
  const [first, second, third] = top;
  return (
    <View style={styles.podium} testID="stats-podium">
      <PodiumCard item={second} place={2} />
      <PodiumCard item={first} place={1} />
      <PodiumCard item={third} place={3} />
    </View>
  );
}

const PLACE_STYLE = {
  1: { medal: '🥇', tone: '#d9a441' },
  2: { medal: '🥈', tone: '#9ca3af' },
  3: { medal: '🥉', tone: '#b06a3b' },
} as const;

function PodiumCard({ item, place }: { item: WornItem; place: 1 | 2 | 3 }) {
  const [missing, setMissing] = useState(false);
  const meta = PLACE_STYLE[place];
  const size = place === 1 ? 84 : 64;

  return (
    <View style={[styles.card, place === 1 && styles.cardFirst]} testID={`stats-podium-${place}`}>
      {place === 1 ? (
        <View style={styles.favorite} testID="stats-podium-favorite">
          <Text style={styles.favoriteLabel}>Favorite</Text>
        </View>
      ) : null}
      {missing ? (
        <View style={[styles.image, styles.placeholder, { height: size, width: size }]}>
          <Text style={styles.placeholderLabel}>{item.category}</Text>
        </View>
      ) : (
        <Image
          testID={`stats-podium-image-${item.id}`}
          source={itemImageUri(item.imageFile)}
          contentFit="cover"
          style={[styles.image, { height: size, width: size }]}
          onError={() => setMissing(true)}
        />
      )}
      <Text style={styles.medal}>{meta.medal}</Text>
      <Text style={styles.cardName} numberOfLines={1}>
        {item.name ?? item.category}
      </Text>
      <Text style={[styles.cardCount, { color: meta.tone }]}>
        {item.wearCount} {item.wearCount === 1 ? 'wear' : 'wears'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  podium: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  cardFirst: {
    marginBottom: 14,
  },
  favorite: {
    backgroundColor: '#3a2a6d',
    borderRadius: 999,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  favoriteLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  image: {
    borderRadius: 14,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#e9e6f0',
    justifyContent: 'center',
  },
  placeholderLabel: {
    fontSize: 11,
    opacity: 0.55,
  },
  medal: {
    fontSize: 20,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '100%',
    textAlign: 'center',
  },
  cardCount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
