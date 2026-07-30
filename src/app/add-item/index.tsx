import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { PermissionDeniedCard } from '@/components/permission-denied-card';
import {
  captureFromCamera,
  captureFromLibrary,
  type CaptureResult,
  type DeniableSource,
} from '@/photo-capture';
import { useTheme, type Theme } from '@/theme';

/**
 * Step 1 — pick a source (§5.1). All three are live and listed with **Import
 * from web** highlighted as the primary path — it walks to the paste-link step
 * (§5.3). Camera and library each mint the item's UUID **at capture** (§4.2) and
 * carry it, with the captured file, into the confirm step — no page metadata
 * means no name/brand pre-fill on either (§5.2).
 *
 * Permission denial silences **one source in place** (§5.6): its tile becomes a
 * reason card with a Settings deep link, the other sources stay live, and the
 * wizard never restarts. iOS owns the first-denial alert; our card is what
 * remains after it's dismissed.
 */
export default function SourceStep() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { setCapture } = useAddItemDraft();
  const [denied, setDenied] = useState<Set<DeniableSource>>(new Set());

  async function capture(source: DeniableSource, launch: () => Promise<CaptureResult>) {
    const result = await launch();
    if (result.status === 'denied') {
      setDenied((prev) => new Set(prev).add(source));
      return;
    }
    if (result.status === 'captured') {
      setCapture(result.capture);
      router.push('/add-item/confirm');
    }
  }

  return (
    <View style={styles.screen} testID="source-step">
      <SourceTile
        testID="source-web"
        primary
        title="Import from web"
        subtitle="Paste a product link — best photo, brand and name"
        onPress={() => router.push('/add-item/paste-link')}
        styles={styles}
      />
      {denied.has('camera') ? (
        <PermissionDeniedCard testID="source-camera-denied" source="Camera" />
      ) : (
        <SourceTile
          testID="source-camera"
          title="Take a photo"
          subtitle="Shoot the item with your camera"
          onPress={() => capture('camera', captureFromCamera)}
          styles={styles}
        />
      )}
      {denied.has('library') ? (
        <PermissionDeniedCard testID="source-library-denied" source="Photo library" />
      ) : (
        <SourceTile
          testID="source-library"
          title="Choose from library"
          subtitle="Pick an existing photo"
          onPress={() => capture('library', captureFromLibrary)}
          styles={styles}
        />
      )}
    </View>
  );
}

function SourceTile({
  title,
  subtitle,
  primary,
  onPress,
  testID,
  styles,
}: {
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: false }}
      onPress={onPress}
      style={[styles.tile, primary && styles.tilePrimary]}
      testID={testID}
    >
      <Text style={[styles.tileTitle, primary && styles.tileTitlePrimary]}>{title}</Text>
      <Text style={[styles.tileSubtitle, primary && styles.tileSubtitlePrimary]}>{subtitle}</Text>
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      gap: 14,
      padding: 20,
    },
    tile: {
      backgroundColor: theme.fill,
      borderRadius: 16,
      gap: 4,
      padding: 20,
    },
    tilePrimary: {
      backgroundColor: theme.accent,
    },
    tileTitle: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    tileTitlePrimary: {
      color: theme.onAccent,
    },
    tileSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    tileSubtitlePrimary: {
      color: theme.onAccentMuted,
    },
  });
}
