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
import { PhotoFallback } from '@/components/photo-fallback';
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
 *
 * §5.3 — "None of these — use a photo instead" and a **failed download** both
 * drop into the *same* photo fallback: no new error screen, and the wizard does
 * not restart. The draft still holds the successful parse's `source_url` and
 * name/brand, so the fallback carries them to Review unchanged.
 */
export default function ConfirmImageStep() {
  const router = useRouter();
  const { webImport, setCapture } = useAddItemDraft();
  const [selected, setSelected] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [fallback, setFallback] = useState(false);

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
      // A failed download is not its own error state — it joins the "None of
      // these" branch (§5.3), offering the photo fallback in place.
      setDownloading(false);
      setFallback(true);
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

      {fallback ? (
        <PhotoFallback />
      ) : (
        <>
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
          <Pressable
            accessibilityRole="button"
            disabled={downloading}
            onPress={() => setFallback(true)}
            style={styles.none}
            testID="confirm-image-none"
          >
            <Text style={styles.noneLabel}>None of these — use a photo instead</Text>
          </Pressable>
        </>
      )}
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
  none: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  noneLabel: {
    color: '#3a2a6d',
    fontSize: 15,
    fontWeight: '600',
  },
});
