import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { downloadCandidate } from '@/web-download';

/**
 * Step 3 — confirm image (§5.1): a large preview with the best candidate
 * (`og:image`) auto-picked, and a thumbnail row to **swap** among the other
 * images found on the page. This is the real guard against a confidently-wrong
 * parse — a homepage's hero banner returns 200 and parses cleanly, so it's the
 * user's eye here, not URL validation, that rejects it (§5.3).
 *
 * "Use this image" mints the UUID and downloads the chosen candidate into cache
 * under it (§5.4) — the same `CapturedImage` every source produces — then walks
 * to Review. Nothing is written to the document dir until Save, so backing out
 * here leaves nothing behind (§4.3). If there's no parse result (a deep link
 * straight here), fall back to the source step rather than render an empty frame.
 */
export default function ConfirmImageStep() {
  const router = useRouter();
  const { webImport, setCapture } = useAddItemDraft();
  const [selected, setSelected] = useState(0);
  const [downloading, setDownloading] = useState(false);

  if (webImport === null || webImport.candidates.length === 0) {
    return <Redirect href="/add-item" />;
  }

  const { candidates } = webImport;

  async function useThisImage() {
    if (downloading) return;
    setDownloading(true);
    try {
      const capture = await downloadCandidate(candidates[selected], randomUUID());
      setCapture(capture);
      router.push('/add-item/review');
    } catch {
      // A failed download drops into §5.3's "None of these" branch in a later
      // ticket; here we just re-open the button so the user can try again.
      setDownloading(false);
    }
  }

  return (
    <View style={styles.screen} testID="confirm-image-step">
      <Image
        source={candidates[selected]}
        contentFit="contain"
        style={styles.preview}
        testID="confirm-image-preview"
      />

      {candidates.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbs}
          testID="confirm-image-thumbs"
        >
          {candidates.map((uri, index) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: index === selected }}
              key={uri}
              onPress={() => setSelected(index)}
              testID={`confirm-image-thumb-${index}`}
            >
              <Image
                source={uri}
                contentFit="cover"
                style={[styles.thumb, index === selected && styles.thumbSelected]}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: downloading, busy: downloading }}
        disabled={downloading}
        onPress={useThisImage}
        style={[styles.cta, downloading && styles.ctaDisabled]}
        testID="confirm-image-use"
      >
        {downloading ? (
          <ActivityIndicator color="#ffffff" testID="confirm-image-spinner" />
        ) : (
          <Text style={styles.ctaLabel}>Use this image</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 16,
    padding: 20,
  },
  preview: {
    backgroundColor: '#f2f1f6',
    borderRadius: 16,
    flex: 1,
  },
  thumbs: {
    gap: 10,
    paddingVertical: 2,
  },
  thumb: {
    backgroundColor: '#f2f1f6',
    borderRadius: 10,
    height: 64,
    width: 64,
  },
  thumbSelected: {
    borderColor: '#3a2a6d',
    borderWidth: 3,
  },
  cta: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 16,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
