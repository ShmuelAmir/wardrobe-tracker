import type { Id } from '@convex/_generated/dataModel';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { draftStore } from './draft-store';
import type { NormalizedImage } from './normalize-image';

/**
 * §5.7 — the wizard's draft: a context over a persisted record, so the walk
 * survives a reload as well as a route change. Reload is a normal act on the
 * web, so treating it as a restart would contradict ADR-0010 outright.
 *
 * Three facts live here. `image` is what Review will commit, in whichever of the
 * two shapes its source produced. `storageId` is the file that image already
 * occupies in Convex storage, and its only job is to keep a **retried insert
 * from repeating the upload** (§4.4). `imported` is everything a web import read
 * off the product page — carried whether or not an image came with it, which is
 * what makes §5.5's dead end a continuation rather than a restart.
 *
 * The Review fields stay the form's own state until Save.
 */

/**
 * The two shapes an image reaches Review in, and the asymmetry is §4.2's: an
 * uploaded file is normalized in the browser and is still only a blob, while a
 * web import is normalized and stored by the action, so the browser never holds
 * its bytes and previews the stored file by URL instead.
 */
export type DraftImage =
  | ({ kind: 'local' } & NormalizedImage)
  | { kind: 'stored'; storageId: Id<'_storage'>; url: string; width: number; height: number };

/** §5.5 — what a parsed page carries forward, image or no image. */
export type ImportedPage = {
  /** `Response.url` after redirects, or the pasted string if nothing resolved. */
  sourceUrl: string;
  name: string | null;
  brand: string | null;
  /** Best-first; `[0]` is the confirm step's auto-pick. Empty on a dead end. */
  candidates: string[];
  /**
   * Why no image came with the page, in the importer's own words, or null when
   * nothing failed — the bail-out at the confirm step has no failure to report.
   */
  message: string | null;
};

export type AddItemDraftRecord = {
  image: DraftImage | null;
  storageId: Id<'_storage'> | null;
  imported: ImportedPage | null;
};

/**
 * Exported because a test resuming or clearing this flow has to reach the same
 * record the wizard writes; naming the flow twice is how the two drift apart.
 */
export const addItemDraftStore = draftStore<AddItemDraftRecord>('add-item');

type Draft = AddItemDraftRecord & {
  /** A new image invalidates any upload of the old one, so the id resets with it. */
  setImage: (image: NormalizedImage) => void;
  setStoredImage: (stored: { storageId: Id<'_storage'>; url: string } & ImageSize) => void;
  setImported: (imported: ImportedPage) => void;
  /** Drop the image but keep the parse — the confirm step's "none of these". */
  clearImage: () => void;
  setStorageId: (storageId: Id<'_storage'>) => void;
  clear: () => void;
};

type ImageSize = { width: number; height: number };

const DraftContext = createContext<Draft | null>(null);

const EMPTY: AddItemDraftRecord = { image: null, storageId: null, imported: null };

/**
 * A persisted record is only resumable if it still has the shape this build
 * reads. A draft written before `image` became a tagged union has no `kind`, and
 * resuming it renders an empty image slot behind an *enabled* Save — so a record
 * that fails the check is dropped rather than half-restored. There is nothing to
 * migrate: the draft is one in-flight walk, and dropping it costs a re-pick.
 */
function resumable(record: AddItemDraftRecord | null): AddItemDraftRecord | null {
  if (record === null) return null;

  const image = record.image;
  if (image !== null && image !== undefined && image.kind !== 'local' && image.kind !== 'stored') {
    return null;
  }
  return record;
}

export function AddItemDraftProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<AddItemDraftRecord | null>(null);
  // The steps' redirect guards read an empty draft as "dead step", so nothing
  // may render until the resume has had its turn — otherwise a cold load of
  // `/add/review` bounces before its own draft arrives.
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    let live = true;
    const settle = (found: AddItemDraftRecord | null) => {
      if (!live) return;
      setRecord(found);
      setResumed(true);
    };

    addItemDraftStore.read().then((found) => settle(resumable(found)), () => settle(null));

    return () => {
      live = false;
    };
  }, []);

  /**
   * The writers are stable, so a caller can depend on one without depending on
   * the draft it changes — `SavedStep` drops the record in an effect, which
   * would re-run forever if `clear` were reallocated by its own result.
   *
   * Each one edits the record rather than replacing it, because a web import
   * writes `imported` **before** an image exists and an image dropped on Review
   * arrives **after** — neither may erase the other.
   */
  const writers = useMemo(() => {
    // Persistence is a resume, not a prerequisite — a browser that refuses
    // storage (private mode, a denied quota) leaves the wizard working in
    // memory rather than failing outright, here and on the read above.
    const persist = (next: AddItemDraftRecord) => {
      addItemDraftStore.write(next).catch(() => {});
      return next;
    };
    const edit = (change: (current: AddItemDraftRecord) => AddItemDraftRecord) =>
      setRecord((current) => persist(change(current ?? EMPTY)));

    return {
      setImage: (image: NormalizedImage) =>
        edit((current) => ({ ...current, image: { kind: 'local', ...image }, storageId: null })),
      setStoredImage: (stored: { storageId: Id<'_storage'>; url: string } & ImageSize) =>
        edit((current) => ({
          ...current,
          image: { kind: 'stored', ...stored },
          storageId: stored.storageId,
        })),
      setImported: (imported: ImportedPage) => edit((current) => ({ ...current, imported })),
      // The stored file is left where it is: the daily sweep reclaims an orphan
      // (§4.4), and deleting it here would be a second failure mode to get right.
      clearImage: () => edit((current) => ({ ...current, image: null, storageId: null })),
      setStorageId: (storageId: Id<'_storage'>) => edit((current) => ({ ...current, storageId })),
      clear: () => {
        addItemDraftStore.drop().catch(() => {});
        setRecord(null);
      },
    };
  }, []);

  const value = useMemo<Draft>(
    () => ({ ...(record ?? EMPTY), ...writers }),
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
