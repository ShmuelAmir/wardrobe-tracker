import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { PermissionDeniedCard } from '@/components/permission-denied-card';
import { Text } from '@/components/text';
import {
  captureFromCamera,
  captureFromLibrary,
  type CaptureResult,
  type DeniableSource,
} from '@/photo-capture';
import { spacing, useTheme, type Theme } from '@/theme';

/**
 * §5.3 — the escape hatch shared by both routes to the fallback: the paste-link
 * dead-end ("Couldn't get an image from that page") and step 3's "None of these
 * — use a photo instead". Either way the wizard **does not restart** — a captured
 * or picked photo continues straight to Review, carrying whatever the draft
 * already holds (`source_url` always; name/brand when a page was parsed).
 *
 * The caller seeds that carried metadata into the draft **before** rendering this
 * (the dead-end sets it from the parse; confirm-image already has the full parse
 * from the successful fetch). This component only owns capture → Review, so both
 * routes behave identically and neither introduces a new error screen.
 *
 * A denied source is silenced in place with the same reason card the source step
 * uses; the other source stays live beside it.
 */
export function PhotoFallback({ message }: { message?: string }) {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
      router.push('/add-item/review');
    }
  }

  return (
    <View style={styles.fallback} testID="photo-fallback">
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {denied.has('camera') ? (
        <PermissionDeniedCard testID="fallback-camera-denied" source="Camera" />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => capture('camera', captureFromCamera)}
          style={styles.action}
          testID="fallback-camera"
        >
          <Text style={styles.actionLabel}>Take a photo</Text>
        </Pressable>
      )}
      {denied.has('library') ? (
        <PermissionDeniedCard testID="fallback-library-denied" source="Photo library" />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => capture('library', captureFromLibrary)}
          style={styles.action}
          testID="fallback-library"
        >
          <Text style={styles.actionLabel}>Choose from library</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    fallback: {
      gap: spacing.md,
    },
    message: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    action: {
      alignItems: 'center',
      backgroundColor: theme.border,
      borderRadius: 14,
      paddingVertical: spacing.lg,
    },
    actionLabel: {
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
