import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';

/**
 * A stored item image that degrades to a category placeholder when the file is
 * missing (§4.5) — the §4.1 `contentFit: 'cover'` tile, minus the thumbnail
 * store (§10.8). Extracted because the Stats leaderboard row and podium card
 * both need the same image-or-placeholder behaviour at different sizes; callers
 * supply the sizing `style` and a `testIDPrefix` so each site keeps its own
 * testIDs (`<prefix>-<id>` for the image, `<prefix>-placeholder-<id>` for the
 * fallback).
 */
export function ItemImage({
  item,
  style,
  placeholderTextStyle,
  testIDPrefix,
}: {
  item: Pick<Item, 'id' | 'imageFile' | 'category'>;
  style: StyleProp<ViewStyle>;
  placeholderTextStyle?: StyleProp<TextStyle>;
  testIDPrefix: string;
}) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <View style={[style, styles.placeholder]} testID={`${testIDPrefix}-placeholder-${item.id}`}>
        <Text style={[styles.placeholderLabel, placeholderTextStyle]}>{item.category}</Text>
      </View>
    );
  }

  return (
    <Image
      testID={`${testIDPrefix}-${item.id}`}
      source={itemImageUri(item.imageFile)}
      contentFit="cover"
      // Callers build the sizing as a `ViewStyle` (dimensions + radius + bg, all
      // valid on both) — narrow it to what `expo-image` types its `style` as.
      style={style as StyleProp<ImageStyle>}
      onError={() => setMissing(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#e9e6f0',
    justifyContent: 'center',
  },
  placeholderLabel: {
    opacity: 0.55,
    textAlign: 'center',
  },
});
