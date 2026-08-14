import { CATEGORIES, SEASONS, type Category, type Season } from '@/item-taxonomy';
import { useState } from 'react';

/**
 * §5.6's field set and its one rule: **category is the only required field**.
 * The state and the fields are separate exports because the same screen serves
 * two modes — the wizard's in-content Save and Edit's nav-bar Save drive the
 * same fields under the same rules, so the identity the modes share is this hook
 * plus `ReviewFields`, not two parallel editors.
 */

/** What Review commits. The derived wear stats are absent by design (§3.1). */
export type ReviewSubmission = {
  category: Category;
  name?: string;
  brand?: string;
  season?: Season[];
};

const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

/** Empty or whitespace-only text is unset, so the field is absent, not blank. */
function textOrAbsent(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type ReviewFormState = {
  category: Category | null;
  setCategory: (value: Category) => void;
  name: string;
  setName: (value: string) => void;
  brand: string;
  setBrand: (value: string) => void;
  season: Season[];
  toggleSeason: (value: Season) => void;
  /** Null until category is set, which is what both modes' Save gates on. */
  build: () => ReviewSubmission | null;
};

/**
 * Pre-fill, which on the wizard's web-import path is what a parsed page gave us
 * (§5.6) and in Edit mode is the row. Absent fields start blank — **blank beats
 * junk**, so a name the cleanup could not salvage is an empty field to type in
 * rather than a site slogan to delete first (§5.3).
 */
export type ReviewPrefill = { name?: string | null; brand?: string | null };

export function useReviewForm(prefill: ReviewPrefill = {}): ReviewFormState {
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState(prefill.name ?? '');
  const [brand, setBrand] = useState(prefill.brand ?? '');
  const [season, setSeason] = useState<Season[]>([]);

  return {
    category,
    setCategory,
    name,
    setName,
    brand,
    setBrand,
    season,
    toggleSeason: (value) =>
      setSeason((current) =>
        current.includes(value) ? current.filter((s) => s !== value) : [...current, value],
      ),
    build: () =>
      category === null
        ? null
        : {
            category,
            name: textOrAbsent(name),
            brand: textOrAbsent(brand),
            season: season.length > 0 ? season : undefined,
          },
  };
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className="review__chip" type="button" aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  );
}

export function ReviewFields({ state }: { state: ReviewFormState }) {
  return (
    <>
      <fieldset className="review__field">
        <legend className="review__label">Category</legend>
        <div className="review__chips">
          {CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={state.category === value}
              onClick={() => state.setCategory(value)}
            />
          ))}
        </div>
      </fieldset>

      <label className="review__field">
        <span className="review__label">Name</span>
        <input
          className="review__input"
          placeholder="Optional"
          value={state.name}
          onChange={(event) => state.setName(event.target.value)}
        />
      </label>

      <label className="review__field">
        <span className="review__label">Brand</span>
        <input
          className="review__input"
          placeholder="Optional"
          value={state.brand}
          onChange={(event) => state.setBrand(event.target.value)}
        />
      </label>

      <fieldset className="review__field">
        <legend className="review__label">Season</legend>
        <div className="review__chips">
          {SEASONS.map((value) => (
            <Chip
              key={value}
              label={SEASON_LABELS[value]}
              selected={state.season.includes(value)}
              onClick={() => state.toggleSeason(value)}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}
