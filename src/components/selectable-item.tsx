import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';

/**
 * One tappable item thumbnail, shared by the builder's rails (§6.1.1) and the
 * "See all" grid (§6.1.2) so selection looks identical in both. Selected items
 * get an **accent ring + check**; a missing file degrades to the same category
 * placeholder the Wardrobe grid uses (§10.8) rather than a broken tile.
 */
export function SelectableItem({
  item,
  selected,
  onToggle,
}: {
  item: Item;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onToggle(item.id)}
      style={styles.cell}
      testID={`select-item-${item.id}`}
    >
      {missing ? (
        <View style={[styles.image, styles.placeholder]} testID={`select-placeholder-${item.id}`}>
          <Text style={styles.placeholderLabel}>{item.category}</Text>
        </View>
      ) : (
        <Image
          testID={`select-image-${item.id}`}
          source={itemImageUri(item.imageFile)}
          contentFit="cover"
          style={styles.image}
          onError={() => setMissing(true)}
        />
      )}
      {selected ? (
        <>
          <View style={styles.ring} pointerEvents="none" />
          <View style={styles.check} testID={`select-check-${item.id}`}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    borderRadius: 12,
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#e9e6f0',
    justifyContent: 'center',
  },
  placeholderLabel: {
    fontSize: 12,
    opacity: 0.55,
  },
  ring: {
    borderColor: '#3a2a6d',
    borderRadius: 12,
    borderWidth: 3,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  check: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
    top: 5,
    width: 24,
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
