import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { OutfitCoverImage } from '@/components/outfit-cover-image';
import type { OutfitCard } from '@/db/queries';

/**
 * §7.1 — the "Wear again" rail: a horizontal strip of the 5 most recently worn
 * outfits, each a one-tap **today-only** log. It's a deliberate strict subset of
 * Detail (no backfill, no other day) because it's the fast path for the only
 * thing a user does daily. The parent owns the write and its Undo toast, so this
 * component only turns taps into calls and flips the tapped card to its in-place
 * `✓ Worn today` confirmation.
 *
 * The rail's scope (`wears ≥ 1`) and its "render nothing when empty" rule live
 * in the parent: it passes only worn outfits and doesn't mount the rail at all
 * when there are none, so there's no empty scaffold here to guard.
 */
export function WearAgainRail({
  outfits,
  confirmedOutfitId,
  onWoreIt,
  onOpen,
}: {
  outfits: OutfitCard[];
  /** The outfit whose card shows `✓ Worn today` — the just-logged tap, while its toast is up. */
  confirmedOutfitId: number | null;
  onWoreIt: (outfitId: number) => void;
  onOpen: (outfitId: number) => void;
}) {
  return (
    <View style={styles.section} testID="wear-again-rail">
      <Text style={styles.heading}>Wear again</Text>
      <FlatList
        horizontal
        data={outfits}
        keyExtractor={(outfit) => String(outfit.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item: outfit }) => (
          <WearAgainCard
            outfit={outfit}
            confirmed={confirmedOutfitId === outfit.id}
            onWoreIt={() => onWoreIt(outfit.id)}
            onOpen={() => onOpen(outfit.id)}
          />
        )}
      />
    </View>
  );
}

function WearAgainCard({
  outfit,
  confirmed,
  onWoreIt,
  onOpen,
}: {
  outfit: OutfitCard;
  confirmed: boolean;
  onWoreIt: () => void;
  onOpen: () => void;
}) {
  const title = outfit.name ?? 'Untitled outfit';

  return (
    <View style={styles.card} testID={`wear-again-card-${outfit.id}`}>
      <Pressable accessibilityRole="button" onPress={onOpen} testID={`wear-again-open-${outfit.id}`}>
        <OutfitCoverImage
          imageFile={outfit.coverImage}
          style={styles.cover}
          testID={`wear-again-cover-${outfit.id}`}
        />
      </Pressable>
      <Text style={styles.name} numberOfLines={1}>
        {title}
      </Text>
      {confirmed ? (
        <View style={styles.confirmed} testID={`wear-again-confirmed-${outfit.id}`}>
          <Text style={styles.confirmedLabel}>✓ Worn today</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onWoreIt}
          style={styles.woreIt}
          testID={`wear-again-wore-it-${outfit.id}`}
        >
          <Text style={styles.woreItLabel}>Wore it</Text>
        </Pressable>
      )}
    </View>
  );
}

const CARD_WIDTH = 132;

const styles = StyleSheet.create({
  section: {
    gap: 10,
    paddingTop: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 20,
  },
  rail: {
    gap: 12,
    paddingHorizontal: 20,
  },
  card: {
    gap: 8,
    width: CARD_WIDTH,
  },
  cover: {
    aspectRatio: 1,
    borderRadius: 14,
    width: '100%',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  woreIt: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 10,
    paddingVertical: 10,
  },
  woreItLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmed: {
    alignItems: 'center',
    backgroundColor: '#eceaf2',
    borderRadius: 10,
    paddingVertical: 10,
  },
  confirmedLabel: {
    color: '#3a2a6d',
    fontSize: 15,
    fontWeight: '600',
  },
});
