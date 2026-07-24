import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { itemImageUri } from '@/item-images';

/**
 * An outfit card's cover — the outfit's lowest-id item photo (§7.1/§7.2),
 * resolved by the covers query. `cover` on purpose (never `none`/`fill`, §4.1),
 * matching the grid. Two degrade paths land on the same neutral tile rather than
 * a broken image: a `null` file (a garment-less outfit, §8.4) and a file the OS
 * can't read (the §4.5 orphan window).
 */
export function OutfitCoverImage({
  imageFile,
  style,
  testID,
}: {
  imageFile: string | null;
  /** Shared cover geometry (size + corner radius) — valid on both the Image and its fallback View. */
  style?: StyleProp<ImageStyle>;
  testID?: string;
}) {
  const [missing, setMissing] = useState(false);

  if (imageFile === null || missing) {
    return (
      <View
        style={[styles.placeholder, style as StyleProp<ViewStyle>]}
        testID={testID ? `${testID}-placeholder` : undefined}
      />
    );
  }

  return (
    <Image
      testID={testID}
      source={itemImageUri(imageFile)}
      contentFit="cover"
      style={style}
      onError={() => setMissing(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e9e6f0',
  },
});
