import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { PhotoFallback } from '@/components/photo-fallback';
import { useTheme, type Theme } from '@/theme';
import { isFetchableUrl } from '@/web-import';
import { fetchProductPage } from '@/web-import-fetch';

/**
 * Step 2 — paste a link (§5.1) and its two failure states (§5.3). Fetch lights up
 * on `http(s)` **syntax alone** — never a "is this a product page?" judgement,
 * which step 3 makes instead. "Fetch" is fetch-HTML-and-parse only: an inline
 * spinner on the button, no full-screen loading state.
 *
 * The outcome splits on the user's **next action**, not the diagnosis:
 *
 * - **retryable** (offline, timeout, network failure, 5xx/429) — the page is
 *   unreachable right now, so the field stays editable and the button becomes
 *   **Retry**.
 * - **dead-end** (401/403/404, or a 200 with no usable image) — retrying the
 *   parser can't help, so there is **no Retry**; instead the photo fallback
 *   appears, while the URL field stays populated and **Fetch stays live** (the
 *   403 escape hatch — re-fetching is always physically possible, just not
 *   promoted). The parse's `source_url` and any name/brand are seeded into the
 *   draft so the fallback carries them to Review without restarting the wizard.
 *
 * A **Cancel** during the fetch aborts with the same signal the 10s timeout uses
 * and restores the editable field — an abort the caller asked for is not an error.
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'fetching' }
  | { kind: 'retryable'; message: string }
  | { kind: 'dead-end'; message: string };

export default function PasteLinkStep() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { setWebImport } = useAddItemDraft();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  const fetching = phase.kind === 'fetching';
  const canFetch = isFetchableUrl(url) && !fetching;
  const isDeadEnd = phase.kind === 'dead-end';

  async function fetchPage() {
    if (!canFetch) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase({ kind: 'fetching' });

    const outcome = await fetchProductPage(url, { signal: controller.signal });
    controllerRef.current = null;

    switch (outcome.status) {
      case 'ok':
        setWebImport(outcome.result);
        setPhase({ kind: 'idle' });
        router.push('/add-item/confirm-image');
        return;
      case 'retryable':
        setPhase({ kind: 'retryable', message: outcome.message });
        return;
      case 'dead-end':
        // Seed the carried metadata so the fallback reaches Review with it (§5.3):
        // `source_url` always, name/brand only when a page was actually parsed.
        setWebImport({
          candidates: [],
          sourceUrl: outcome.sourceUrl,
          name: outcome.name,
          brand: outcome.brand,
        });
        setPhase({ kind: 'dead-end', message: outcome.message });
        return;
      case 'cancelled':
        setPhase({ kind: 'idle' });
        return;
    }
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  return (
    <View style={styles.screen} testID="paste-link-step">
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!fetching}
        keyboardType="url"
        onChangeText={setUrl}
        placeholder="https://…"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, fetching && styles.inputDisabled]}
        testID="paste-link-url"
        value={url}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canFetch, busy: fetching }}
        disabled={!canFetch}
        onPress={fetchPage}
        style={[styles.fetch, !canFetch && styles.fetchDisabled]}
        testID="paste-link-fetch"
      >
        {fetching ? (
          <ActivityIndicator color={theme.onAccent} testID="paste-link-spinner" />
        ) : (
          <Text style={styles.fetchLabel}>{phase.kind === 'retryable' ? 'Retry' : 'Fetch'}</Text>
        )}
      </Pressable>

      {fetching ? (
        <Pressable
          accessibilityRole="button"
          onPress={cancel}
          style={styles.cancel}
          testID="paste-link-cancel"
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      ) : null}

      {phase.kind === 'retryable' ? (
        <Text style={styles.error} testID="paste-link-error">
          {phase.message}
        </Text>
      ) : null}

      {isDeadEnd ? <PhotoFallback message={phase.message} /> : null}
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
    input: {
      backgroundColor: theme.fill,
      borderRadius: 10,
      color: theme.textPrimary,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    inputDisabled: {
      opacity: 0.5,
    },
    fetch: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 14,
      justifyContent: 'center',
      minHeight: 52,
      paddingVertical: 16,
    },
    fetchDisabled: {
      opacity: 0.4,
    },
    fetchLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
    cancel: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    cancelLabel: {
      color: theme.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    error: {
      // `danger`, not the warm attention `warning`: a fetch that failed is a
      // failure, not a caution — and at 15px the amber misses AA on the
      // near-white background where the red clears it comfortably.
      color: theme.danger,
      fontSize: 15,
    },
  });
}
