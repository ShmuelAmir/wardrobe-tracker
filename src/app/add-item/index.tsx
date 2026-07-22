import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';

/**
 * Step 1 — pick a source (§5.1). All three are listed with **Import from web**
 * highlighted as the primary path; in this slice only the library works, and
 * web/camera are inert until their own tickets (§5.3, §5.6). Choosing a library
 * photo mints the item's UUID **at capture** (§4.2) and carries it, with the
 * picked file, into the confirm step.
 */
export default function SourceStep() {
  const router = useRouter();
  const { setCapture } = useAddItemDraft();

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setCapture({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      uuid: randomUUID(),
    });
    router.push('/add-item/confirm');
  }

  return (
    <View style={styles.screen} testID="source-step">
      <SourceTile
        testID="source-web"
        primary
        title="Import from web"
        subtitle="Paste a product link — best photo, brand and name"
        // Wired by the web-import ticket (§5.3); primary but inert here.
        onPress={undefined}
      />
      <SourceTile
        testID="source-camera"
        title="Take a photo"
        subtitle="Shoot the item with your camera"
        // Wired by the camera ticket (§5.6).
        onPress={undefined}
      />
      <SourceTile
        testID="source-library"
        title="Choose from library"
        subtitle="Pick an existing photo"
        onPress={pickFromLibrary}
      />
    </View>
  );
}

function SourceTile({
  title,
  subtitle,
  primary,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress?: () => void;
  testID: string;
}) {
  // Inert this slice — but the web tile stays *visually* primary (§5.1), so it
  // wears a "Soon" pill rather than being greyed into a dead button.
  const disabled = onPress === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tile, primary && styles.tilePrimary, disabled && !primary && styles.tileMuted]}
      testID={testID}
    >
      <View style={styles.tileHeader}>
        <Text style={[styles.tileTitle, primary && styles.tileTitlePrimary]}>{title}</Text>
        {disabled ? (
          <Text style={[styles.soon, primary && styles.soonPrimary]}>Soon</Text>
        ) : null}
      </View>
      <Text style={[styles.tileSubtitle, primary && styles.tileSubtitlePrimary]}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 14,
    padding: 20,
  },
  tile: {
    backgroundColor: '#f2f1f6',
    borderRadius: 16,
    gap: 4,
    padding: 20,
  },
  tilePrimary: {
    backgroundColor: '#3a2a6d',
  },
  tileMuted: {
    opacity: 0.55,
  },
  tileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  soon: {
    backgroundColor: '#dcd8ea',
    borderRadius: 999,
    color: '#4a4560',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  soonPrimary: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    color: '#ffffff',
  },
  tileTitle: {
    color: '#1c1830',
    fontSize: 18,
    fontWeight: '700',
  },
  tileTitlePrimary: {
    color: '#ffffff',
  },
  tileSubtitle: {
    color: '#4a4560',
    fontSize: 14,
  },
  tileSubtitlePrimary: {
    color: '#e6e1f5',
  },
});
