import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { CapturedImage } from '@/item-save';
import type { WebImportResult } from '@/web-import';

/**
 * The wizard is always-forward across several full screens (§5.1), so state
 * gathered on one step has to outlive it to reach Review. Route params can't
 * carry a local file handle cleanly, so the draft lives in a context spanning
 * the wizard stack — created empty, filled as the walk proceeds, and dropped
 * when the wizard unmounts.
 *
 * Two things live here. `capture` is the picked/downloaded image every source
 * lands before Review (§4.3). `webImport` is the parse result from step 2 — the
 * candidate images step 3 swaps among, plus the `source_url` and name/brand
 * pre-fill Review reads (§5.3); it stays null on the camera/library paths, which
 * have no page metadata. The Review fields themselves are the ReviewForm's own
 * local state until Save (§5.5).
 */
type Draft = {
  capture: CapturedImage | null;
  setCapture: (capture: CapturedImage) => void;
  webImport: WebImportResult | null;
  setWebImport: (webImport: WebImportResult) => void;
  reset: () => void;
};

const DraftContext = createContext<Draft | null>(null);

export function AddItemDraftProvider({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState<CapturedImage | null>(null);
  const [webImport, setWebImport] = useState<WebImportResult | null>(null);

  const value = useMemo<Draft>(
    () => ({
      capture,
      setCapture,
      webImport,
      setWebImport,
      reset: () => {
        setCapture(null);
        setWebImport(null);
      },
    }),
    [capture, webImport],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useAddItemDraft(): Draft {
  const draft = useContext(DraftContext);
  if (draft === null) {
    throw new Error('useAddItemDraft must be used within an AddItemDraftProvider');
  }
  return draft;
}
