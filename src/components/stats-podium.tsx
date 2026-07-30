import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ItemImage } from '@/components/item-image';
import type { WornItem } from '@/db/queries';
import { useTheme, type Theme } from '@/theme';

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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tones = useMemo(
    () => ({ 1: theme.podiumGold, 2: theme.podiumSilver, 3: theme.podiumBronze }) as const,
    [theme],
  );
  const [first, second, third] = top;
  return (
    <View style={styles.podium} testID="stats-podium">
      <PodiumCard item={second} place={2} styles={styles} tone={tones[2]} />
      <PodiumCard item={first} place={1} styles={styles} tone={tones[1]} />
      <PodiumCard item={third} place={3} styles={styles} tone={tones[3]} />
    </View>
  );
}

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

function PodiumCard({
  item,
  place,
  styles,
  tone,
}: {
  item: WornItem;
  place: 1 | 2 | 3;
  styles: ReturnType<typeof makeStyles>;
  tone: string;
}) {
  const size = place === 1 ? 84 : 64;

  return (
    <View style={[styles.card, place === 1 && styles.cardFirst]} testID={`stats-podium-${place}`}>
      {place === 1 ? (
        <View style={styles.favorite} testID="stats-podium-favorite">
          <Text style={styles.favoriteLabel}>Favorite</Text>
        </View>
      ) : null}
      <ItemImage
        item={item}
        style={[styles.image, { height: size, width: size }]}
        placeholderTextStyle={styles.placeholderLabel}
        testIDPrefix="stats-podium-image"
      />
      <Text style={styles.medal}>{MEDAL[place]}</Text>
      <Text style={styles.cardName} numberOfLines={1}>
        {item.name ?? item.category}
      </Text>
      <Text style={[styles.cardCount, { color: tone }]}>
        {item.wearCount} {item.wearCount === 1 ? 'wear' : 'wears'}
      </Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      backgroundColor: theme.accent,
      borderRadius: 999,
      marginBottom: 2,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    favoriteLabel: {
      color: theme.onAccent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    image: {
      borderRadius: 14,
    },
    placeholderLabel: {
      fontSize: 11,
    },
    medal: {
      fontSize: 20,
    },
    cardName: {
      color: theme.textPrimary,
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
}
