import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * §6 — the builder browses and selects on **one screen with no modal**, but the
 * "See all →" grid (§6.1.2) and the Save review sheet (§6.1.4) are separate
 * routes/surfaces that must see the same in-progress selection. Route params
 * can't carry a growing set cleanly, so the draft lives in a context spanning
 * the builder stack — the selection in **tap order** (front-of-rail depends on
 * it, §6.1.1) plus the name typed in the summary bar.
 */
type BuilderDraft = {
  /** Selected item ids in the order they were tapped. */
  selection: number[];
  /** The name typed in the sticky summary bar (§6.1.3), carried into the sheet. */
  name: string;
  toggle: (id: number) => void;
  isSelected: (id: number) => boolean;
  setName: (name: string) => void;
};

const BuilderContext = createContext<BuilderDraft | null>(null);

export function OutfitBuilderProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<number[]>([]);
  const [name, setName] = useState('');

  const value = useMemo<BuilderDraft>(
    () => ({
      selection,
      name,
      // Re-tapping a selected item removes it; a fresh tap appends, so tap order
      // is preserved and the latest pick is always last (front of its rail).
      toggle: (id) =>
        setSelection((current) =>
          current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
        ),
      isSelected: (id) => selection.includes(id),
      setName,
    }),
    [selection, name],
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useOutfitBuilder(): BuilderDraft {
  const draft = useContext(BuilderContext);
  if (draft === null) {
    throw new Error('useOutfitBuilder must be used within an OutfitBuilderProvider');
  }
  return draft;
}
