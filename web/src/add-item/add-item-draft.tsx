import type { Id } from '@convex/_generated/dataModel';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { draftStore } from './draft-store';
import type { NormalizedImage } from './normalize-image';

/**
 * §5.7 — the wizard's draft: a context over a persisted record, so the walk
 * survives a reload as well as a route change. Reload is a normal act on the
 * web, so treating it as a restart would contradict ADR-0010 outright.
 *
 * Two facts live here. `image` is the normalized blob every source lands before
 * Review — persisted whole, because a JSON-only draft would make the user re-pick
 * an image they had already confirmed. `storageId` is set once that blob reaches
 * Convex storage, and its only job is to make a **retried insert reuse the
 * upload** rather than repeat it (§4.4). The Review fields stay the form's own
 * state until Save.
 */

export type AddItemDraftRecord = {
  image: NormalizedImage;
  storageId: Id<'_storage'> | null;
};

/**
 * Exported because a test resuming or clearing this flow has to reach the same
 * record the wizard writes; naming the flow twice is how the two drift apart.
 */
export const addItemDraftStore = draftStore<AddItemDraftRecord>('add-item');

type Draft = {
  image: NormalizedImage | null;
  storageId: Id<'_storage'> | null;
  /** A new image invalidates any upload of the old one, so the id resets with it. */
  setImage: (image: NormalizedImage) => void;
  setStorageId: (storageId: Id<'_storage'>) => void;
  clear: () => void;
};

const DraftContext = createContext<Draft | null>(null);

export function AddItemDraftProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<AddItemDraftRecord | null>(null);
  // The steps' redirect guards read "no image" as "dead step", so nothing may
  // render until the resume has had its turn — otherwise a cold load of
  // `/add/review` bounces before its own draft arrives.
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    let live = true;
    const settle = (found: AddItemDraftRecord | null) => {
      if (!live) return;
      setRecord(found);
      setResumed(true);
    };

    addItemDraftStore.read().then(settle, () => settle(null));

    return () => {
      live = false;
    };
  }, []);

  /**
   * The three writers are stable, so a caller can depend on one without
   * depending on the draft it changes — `SavedStep` drops the record in an
   * effect, which would re-run forever if `clear` were reallocated by its own
   * result.
   */
  const writers = useMemo(() => {
    // Persistence is a resume, not a prerequisite — a browser that refuses
    // storage (private mode, a denied quota) leaves the wizard working in
    // memory rather than failing outright, here and on the read above.
    const persist = (next: AddItemDraftRecord | null) => {
      (next === null ? addItemDraftStore.drop() : addItemDraftStore.write(next)).catch(() => {});
      return next;
    };

    return {
      setImage: (image: NormalizedImage) => setRecord(persist({ image, storageId: null })),
      setStorageId: (storageId: Id<'_storage'>) =>
        setRecord((current) => (current === null ? current : persist({ ...current, storageId }))),
      clear: () => setRecord(persist(null)),
    };
  }, []);

  const value = useMemo<Draft>(
    () => ({
      image: record?.image ?? null,
      storageId: record?.storageId ?? null,
      ...writers,
    }),
    [record, writers],
  );

  return resumed ? <DraftContext.Provider value={value}>{children}</DraftContext.Provider> : null;
}

export function useAddItemDraft(): Draft {
  const draft = useContext(DraftContext);
  if (draft === null) {
    throw new Error('useAddItemDraft must be used within an AddItemDraftProvider');
  }
  return draft;
}
