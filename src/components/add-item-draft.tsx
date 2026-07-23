import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { CapturedImage } from '@/item-save';

/**
 * The wizard is always-forward across several full screens (§5.1), so the image
 * picked on the source step has to outlive that step to reach Review. Route
 * params can't carry a local file handle cleanly, so the draft lives in a
 * context spanning the wizard stack — created empty, filled at capture, and
 * dropped when the wizard unmounts.
 *
 * Only the captured image lives here; the Review fields are the ReviewForm's own
 * local state until Save (§5.5). The web-import path's `source_url` joins the
 * draft with its own ticket (§5.3).
 */
type Draft = {
  capture: CapturedImage | null;
  setCapture: (capture: CapturedImage) => void;
  reset: () => void;
};

const DraftContext = createContext<Draft | null>(null);

export function AddItemDraftProvider({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState<CapturedImage | null>(null);

  const value = useMemo<Draft>(
    () => ({
      capture,
      setCapture,
      reset: () => setCapture(null),
    }),
    [capture],
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
