import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OutfitCoverImage } from '@/components/outfit-cover-image';
import { formatIsoDay } from '@/date-format';
import type { OutfitCard } from '@/db/queries';

/**
 * §7.2 — a row in the "All outfits" list: a large cover card that taps through
 * to the outfit's Detail (§8.5). It carries the last-worn line the list is
 * sorted by, so the ordering the user sees is legible on each card ("Never worn"
 * for the aspirational bucket that sinks to the bottom).
 */
export function OutfitCoverCard({
  outfit,
  onPress,
}: {
  outfit: OutfitCard;
  onPress: () => void;
}) {
  const title = outfit.name ?? 'Untitled outfit';
  const count = outfit.itemCount === 1 ? '1 item' : `${outfit.itemCount} items`;
  const worn = outfit.lastWorn ? `Worn ${formatIsoDay(outfit.lastWorn)}` : 'Never worn';

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
        <View style={styles.meta}>
          <Text style={styles.count}>{count}</Text>
          {outfit.occasion ? (
            <View style={styles.occasion}>
              <Text style={styles.occasionLabel}>{outfit.occasion}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.worn} testID={`outfit-card-worn-${outfit.id}`}>
          {worn}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  cover: {
    aspectRatio: 4 / 3,
    borderRadius: 18,
    width: '100%',
  },
  body: {
    gap: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  count: {
    fontSize: 14,
    opacity: 0.6,
  },
  occasion: {
    backgroundColor: '#eceaf2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  occasionLabel: {
    color: '#3a2a6d',
    fontSize: 13,
    fontWeight: '600',
  },
  worn: {
    fontSize: 14,
    opacity: 0.6,
  },
});
