import { Redirect, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';
import { ReviewForm, type ReviewSubmission } from '@/components/review-form';
import { saveItem } from '@/item-save';

/**
 * Step 4 — Review & fill (§5.5), in create mode: the picked image plus the
 * ReviewForm, committed through §4.4's save pipeline. On success the wizard
 * advances to the Saved confirmation; a failed save keeps the user on the form
 * with their entries intact rather than stranding them.
 */
export default function ReviewStep() {
  const router = useRouter();
  const { capture, webImport } = useAddItemDraft();
  const saving = useRef(false);

  if (capture === null) return <Redirect href="/add-item" />;

  async function onSubmit(submission: ReviewSubmission) {
    if (saving.current || capture === null) return;
    saving.current = true;
    try {
      // Camera/library items have no source URL; the web-import path carries the
      // resolved product URL through the draft (§5.3).
      await saveItem(capture, { ...submission, sourceUrl: webImport?.sourceUrl ?? null });
      router.replace('/add-item/saved');
    } catch {
      saving.current = false;
      Alert.alert("Couldn't save this item", 'Something went wrong. Please try again.');
    }
  }

  // Web import pre-fills Name/Brand from the cleaned page metadata (§5.3);
  // camera/library leave the draft's `webImport` null and the fields start blank.
  return (
    <ReviewForm
      onSubmit={onSubmit}
      initialName={webImport?.name}
      initialBrand={webImport?.brand}
    />
  );
}
