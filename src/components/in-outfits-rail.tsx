import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { OutfitCoverImage } from '@/components/outfit-cover-image';
import type { ItemOutfit } from '@/db/queries';

/**
 * §8.1 "In outfits" rail — the outfits containing this item, each a cover that
 * taps through to its own detail. The empty case is the point of the section: it
 * doesn't just show a zero wear count, it **explains** it — an item in no outfit
 * has never been worn *because* nothing wears it. Covers reuse `OutfitCoverImage`
 * so a garment-less or missing-file cover degrades to the same neutral tile the
 * cards use.
 */
export function InOutfitsRail({
  outfits,
  onPressOutfit,
}: {
  outfits: ItemOutfit[];
  onPressOutfit: (id: number) => void;
}) {
  if (outfits.length === 0) {
    return (
      <Text style={styles.empty} testID="in-outfits-empty">
        Not in any outfit yet — that&apos;s why it has never been worn.
      </Text>
    );
  }

  return (
    <FlatList
      testID="in-outfits-rail"
      horizontal
      data={outfits}
      keyExtractor={(row) => String(row.id)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.name ?? 'Untitled outfit'}
          onPress={() => onPressOutfit(item.id)}
          style={styles.card}
          testID={`in-outfit-${item.id}`}
        >
          <OutfitCoverImage
            imageFile={item.coverImage}
            style={styles.cover}
            testID={`in-outfit-cover-${item.id}`}
          />
          <Text style={styles.name} numberOfLines={1}>
            {item.name ?? 'Untitled outfit'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const CARD_SIZE = 108;

const styles = StyleSheet.create({
  rail: {
    gap: 12,
    paddingHorizontal: 20,
  },
  empty: {
    color: '#4a4560',
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  card: {
    gap: 6,
    width: CARD_SIZE,
  },
  cover: {
    borderRadius: 12,
    height: CARD_SIZE,
    width: CARD_SIZE,
  },
  name: {
    fontSize: 13,
    opacity: 0.75,
  },
});
