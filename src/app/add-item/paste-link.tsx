import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { fetchProductPage, isFetchableUrl } from '@/web-import';

/**
 * Step 2 — paste a link (§5.1): a single URL field and **Fetch**, nothing else.
 * Fetch is enabled on `http(s)` **syntax alone** (§5.3) — never a "is this a
 * product page?" judgement, which step 3 makes instead. "Fetch" is fetch-HTML-
 * and-parse only: no dedicated loading screen, just an inline spinner on the
 * button with the field disabled while it runs (§5.3). The parse result is
 * dropped in the draft for step 3 to confirm.
 *
 * §5.3's failure states are their own ticket; on this happy-path slice a failed
 * fetch simply releases the in-flight lock so the URL stays editable and Fetch
 * stays live — the classification biasing never locks anyone out.
 */
export default function PasteLinkStep() {
  const router = useRouter();
  const { setWebImport } = useAddItemDraft();
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);

  const canFetch = isFetchableUrl(url) && !fetching;

  async function fetchPage() {
    if (!canFetch) return;
    setFetching(true);
    try {
      const result = await fetchProductPage(url);
      setWebImport(result);
      router.push('/add-item/confirm-image');
    } catch {
      // The failure states (§5.3) land in a later ticket; here we only re-open
      // the field and Fetch so the user can edit and retry.
    } finally {
      setFetching(false);
    }
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
          <ActivityIndicator color="#ffffff" testID="paste-link-spinner" />
        ) : (
          <Text style={styles.fetchLabel}>Fetch</Text>
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
  input: {
    backgroundColor: '#f5f4f8',
    borderRadius: 10,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  fetch: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 16,
  },
  fetchDisabled: {
    opacity: 0.4,
  },
  fetchLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
