import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';

// The two sources iOS can permission-block. Web-import can never be denied
// (§5.6), so it never appears here.
type DeniableSource = 'camera' | 'library';

/**
 * Step 1 — pick a source (§5.1). All three are listed with **Import from web**
 * highlighted as the primary path; web is still inert until its own ticket
 * (§5.3). Camera and library are live: each mints the item's UUID **at capture**
 * (§4.2) and carries it, with the captured file, into the confirm step — no
 * page metadata means no name/brand pre-fill on either (§5.2).
 *
 * Permission denial silences **one source in place** (§5.6): its tile becomes a
 * reason card with a Settings deep link, the other sources stay live, and the
 * wizard never restarts. iOS owns the first-denial alert; our card is what
 * remains after it's dismissed.
 */
export default function SourceStep() {
  const router = useRouter();
  const { setCapture } = useAddItemDraft();
  const [denied, setDenied] = useState<Set<DeniableSource>>(new Set());

  function markDenied(source: DeniableSource) {
    setDenied((prev) => new Set(prev).add(source));
  }

  function carryForward(result: ImagePicker.ImagePickerResult) {
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

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      markDenied('camera');
      return;
    }
    carryForward(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      markDenied('library');
      return;
    }
    carryForward(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));
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
      {denied.has('camera') ? (
        <PermissionDeniedCard testID="source-camera-denied" source="Camera" />
      ) : (
        <SourceTile
          testID="source-camera"
          title="Take a photo"
          subtitle="Shoot the item with your camera"
          onPress={takePhoto}
        />
      )}
      {denied.has('library') ? (
        <PermissionDeniedCard testID="source-library-denied" source="Photo library" />
      ) : (
        <SourceTile
          testID="source-library"
          title="Choose from library"
          subtitle="Pick an existing photo"
          onPress={pickFromLibrary}
        />
      )}
    </View>
  );
}

/**
 * A denied source, replaced in place (§5.6). It states the reason and deep-links
 * to Settings; it never blocks the other sources or the wizard.
 */
function PermissionDeniedCard({ source, testID }: { source: string; testID: string }) {
  return (
    <View style={styles.deniedCard} testID={testID}>
      <Text style={styles.deniedTitle}>{source} access is off</Text>
      <Text style={styles.deniedBody}>
        Turn it on to add photos this way. The other options still work.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openSettings()}
        testID={`${testID}-settings`}
      >
        <Text style={styles.deniedLink}>Turn it on in Settings →</Text>
      </Pressable>
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
  deniedCard: {
    backgroundColor: '#faf0ee',
    borderColor: '#e7c4bd',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 20,
  },
  deniedTitle: {
    color: '#7a2e1f',
    fontSize: 16,
    fontWeight: '700',
  },
  deniedBody: {
    color: '#7a5b54',
    fontSize: 14,
  },
  deniedLink: {
    color: '#b23c22',
    fontSize: 15,
    fontWeight: '600',
    paddingTop: 6,
  },
});
