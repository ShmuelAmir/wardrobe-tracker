import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { useTheme, type Theme } from '@/theme';

/**
 * Confirm the photo (§5.2) — the library path's stand-in for the web path's
 * image-picker step. A large preview and a single forward action; Back is the
 * stack's. If there's no captured image (a deep link straight here), fall back
 * to the source step rather than render an empty frame.
 */
export default function ConfirmStep() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { capture } = useAddItemDraft();

  if (capture === null) return <Redirect href="/add-item" />;

  return (
    <View style={styles.screen} testID="confirm-step">
      <Image
        source={capture.uri}
        contentFit="contain"
        style={styles.preview}
        testID="confirm-preview"
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/add-item/review')}
        style={styles.cta}
        testID="confirm-use-photo"
      >
        <Text style={styles.ctaLabel}>Use this photo</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      gap: 16,
      padding: 20,
    },
    preview: {
      backgroundColor: theme.fill,
      borderRadius: 16,
      flex: 1,
    },
    cta: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingVertical: 16,
    },
    ctaLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
