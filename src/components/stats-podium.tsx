import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ItemImage } from '@/components/item-image';
import type { WornItem } from '@/db/queries';
import { wearCountLabel } from '@/stats-copy';
import { useTheme, type Theme } from '@/theme';

/**
 * §9.4 — the most-worn podium: the top three in **2–1–3** order (center raised),
 * with a "Favorite" crown on #1. It renders only at `k ≥ 3` and is **a view of
 * the capped `mostWorn` slice** — never a fixed three-of-`worn` — so a card the
 * cap excluded can't appear here while also sitting in the least-worn list below
 * (§9.2's both-lists collision).
 *
 * The owning screen passes exactly `mostWorn.slice(0, 3)`; ordering it 2–1–3 is
 * this component's job.
 *
 * **Rank is carried by shape, not by decoration** (#77/§3.3): each place is a
 * framed tile holding the real photo, and #1 differs by being taller, tinted
 * (`accentSoft` fill behind an `accent` hairline) and larger-imaged. That is why
 * the 🥇🥈🥉 emojis and the three medal-tone roles are gone — height plus the
 * 2–1–3 position already say which is which, twice over.
 */
export function StatsPodium({ top }: { top: WornItem[] }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [first, second, third] = top;
  return (
    <View style={styles.podium} testID="stats-podium">
      <PodiumCard item={second} place={2} styles={styles} />
      <PodiumCard item={first} place={1} styles={styles} />
      <PodiumCard item={third} place={3} styles={styles} />
    </View>
  );
}

function PodiumCard({
  item,
  place,
  styles,
}: {
  item: WornItem;
  place: 1 | 2 | 3;
  styles: ReturnType<typeof makeStyles>;
}) {
  const first = place === 1;
  const size = first ? 48 : 40;

  return (
    <View style={[styles.card, first && styles.cardFirst]} testID={`stats-podium-${place}`}>
      {first ? (
        <Text style={styles.crown} testID="stats-podium-favorite">
          Favorite
        </Text>
      ) : null}
      <ItemImage
        item={item}
        style={[styles.image, { height: size, width: size }]}
        placeholderTextStyle={styles.placeholderLabel}
        testIDPrefix="stats-podium-image"
      />
      <Text style={styles.cardName} numberOfLines={1}>
        {item.name ?? item.category}
      </Text>
      <Text style={styles.cardCount} numberOfLines={1}>
        {wearCountLabel(item.wearCount)}
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
      backgroundColor: theme.fill,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      justifyContent: 'center',
      // `minHeight`, not `height`: the 96/122 step is what reads as rank, but a
      // long name wrapping must never clip inside a fixed box.
      minHeight: 96,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    // §3.2: the winner's frame is `accent` at 1px over the `accentSoft` well —
    // full-strength accent reads clean at hairline weight, so no alpha role is
    // needed (and `accentSoft` can't serve as its own border).
    cardFirst: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
      minHeight: 122,
    },
    crown: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    image: {
      borderRadius: 10,
    },
    placeholderLabel: {
      fontSize: 10,
    },
    cardName: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      maxWidth: '100%',
      textAlign: 'center',
    },
    cardCount: {
      color: theme.textTertiary,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
