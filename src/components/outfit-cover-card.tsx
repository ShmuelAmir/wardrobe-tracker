import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OutfitCoverImage } from '@/components/outfit-cover-image';
import { formatIsoDay } from '@/date-format';
import type { OutfitCard } from '@/db/queries';
import { useTheme, type Theme } from '@/theme';

/**
 * §7.2 — a row in the "All outfits" list, tapping through to the outfit's Detail
 * (§8.5). The Variant C card (#75) is a compact, bordered, rounded container: a
 * cover thumbnail, a single-row body (name + one folded meta line), and a
 * trailing chevron. The meta folds wear stats and recency into one line
 * ("{n} wears · last {when}", or "Never worn" for the aspirational bucket that
 * sinks to the bottom); the occasion lives on Detail now, not on the card.
 */
export function OutfitCoverCard({
  outfit,
  onPress,
}: {
  outfit: OutfitCard;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const title = outfit.name ?? 'Untitled outfit';
  const meta =
    outfit.lastWorn === null
      ? 'Never worn'
      : `${outfit.timesWorn} ${outfit.timesWorn === 1 ? 'wear' : 'wears'} · last ${formatIsoDay(
          outfit.lastWorn,
        )}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
      testID={`outfit-card-${outfit.id}`}
    >
      <OutfitCoverImage
        imageFile={outfit.coverImage}
        style={styles.cover}
        testID={`outfit-card-cover-${outfit.id}`}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1} testID={`outfit-card-worn-${outfit.id}`}>
          {meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // Bordered, rounded, single-row container.
    card: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 10,
    },
    cover: {
      aspectRatio: 1,
      borderRadius: 10,
      width: 56,
    },
    body: {
      flex: 1,
      gap: 3,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    meta: {
      color: theme.textSecondary,
      fontSize: 13,
    },
  });
}
