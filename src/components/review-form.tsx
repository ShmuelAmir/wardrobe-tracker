import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES, SEASONS, type Category, type Season } from '@/db/schema';
import { useTheme, type Theme } from '@/theme';

/** What Review commits — the derived-on-read stats are absent by design (§3.1). */
export type ReviewSubmission = {
  category: Category;
  name: string | null;
  brand: string | null;
  season: Season[] | null;
};

const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

/** Empty or whitespace-only text is unset, not a value — store null (§5.5). */
function textToNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The §5.5 form's state and validation, extracted from the view so the wizard's
 * in-content Save (create) and §8.2's nav-bar Save (edit) can both drive the
 * *same* fields from the *same* rules. Category is the one required field in
 * either mode; `build()` returns null until it's set, which is what both Save
 * affordances gate on. Initial values pre-fill it — page metadata in create
 * (§5.3), the existing row in edit (§8.2) — so the identity the two modes share
 * is this hook plus `ReviewFields`, not two parallel editors.
 */
export type ReviewFormInitial = {
  category?: Category | null;
  name?: string | null;
  brand?: string | null;
  season?: Season[] | null;
};

export type ReviewFormState = {
  category: Category | null;
  setCategory: (value: Category) => void;
  name: string;
  setName: (value: string) => void;
  brand: string;
  setBrand: (value: string) => void;
  season: Season[];
  toggleSeason: (value: Season) => void;
  canSave: boolean;
  build: () => ReviewSubmission | null;
};

export function useReviewForm(initial?: ReviewFormInitial): ReviewFormState {
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [season, setSeason] = useState<Season[]>(initial?.season ?? []);

  function toggleSeason(value: Season) {
    setSeason((current) =>
      current.includes(value) ? current.filter((s) => s !== value) : [...current, value],
    );
  }

  function build(): ReviewSubmission | null {
    if (category === null) return null;
    return {
      category,
      name: textToNullable(name),
      brand: textToNullable(brand),
      season: season.length > 0 ? season : null,
    };
  }

  return {
    category,
    setCategory,
    name,
    setName,
    brand,
    setBrand,
    season,
    toggleSeason,
    canSave: category !== null,
    build,
  };
}

function Chip({
  label,
  selected,
  onPress,
  testID,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

/**
 * §5.5 — the field set itself: the fixed-six Category chip picker (the only
 * required field), free-text Name and Brand, and the four-value Season
 * multi-select with no "all-season" option. Presentational and mode-agnostic —
 * it renders whatever `useReviewForm` holds — which is exactly why §8.2's editor
 * can reuse it around a different nav bar and a Delete row rather than forking a
 * second form.
 */
export function ReviewFields({ state }: { state: ReviewFormState }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <>
      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={value}
            selected={state.category === value}
            onPress={() => state.setCategory(value)}
            testID={`category-chip-${value}`}
            styles={styles}
          />
        ))}
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        placeholder="Optional"
        placeholderTextColor={theme.textSecondary}
        value={state.name}
        onChangeText={state.setName}
        style={styles.input}
        testID="review-name"
      />

      <Text style={styles.label}>Brand</Text>
      <TextInput
        placeholder="Optional"
        placeholderTextColor={theme.textSecondary}
        value={state.brand}
        onChangeText={state.setBrand}
        style={styles.input}
        testID="review-brand"
      />

      <Text style={styles.label}>Season</Text>
      <View style={styles.chips}>
        {SEASONS.map((value) => (
          <Chip
            key={value}
            label={SEASON_LABELS[value]}
            selected={state.season.includes(value)}
            onPress={() => state.toggleSeason(value)}
            testID={`season-chip-${value}`}
            styles={styles}
          />
        ))}
      </View>
    </>
  );
}

/**
 * §5.5 — Review & fill, the wizard's create-mode step: the shared field set plus
 * an in-content Save that hands a clean submission to its caller (the wizard
 * saves it, §4.4). Category and Season are never pre-filled here — there's no
 * page signal for them; only Name/Brand carry the §5.3 web-import metadata. Edit
 * mode (§8.2) reuses `ReviewFields`/`useReviewForm` around a nav-bar Save
 * instead, which is why persistence — and now the Save affordance — stays with
 * the caller rather than living in the shared parts.
 */
export function ReviewForm({
  onSubmit,
  initialName,
  initialBrand,
}: {
  onSubmit: (submission: ReviewSubmission) => void;
  // §5.3 — the web-import path pre-fills Name/Brand from the cleaned page
  // metadata; camera/library leave these undefined and the fields start blank.
  // Category and Season are never pre-filled — there's no page signal for them.
  initialName?: string | null;
  initialBrand?: string | null;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const state = useReviewForm({ name: initialName, brand: initialBrand });

  function submit() {
    const submission = state.build();
    if (submission) onSubmit(submission);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} testID="review-form">
      <ReviewFields state={state} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !state.canSave }}
        disabled={!state.canSave}
        onPress={submit}
        style={[styles.save, !state.canSave && styles.saveDisabled]}
        testID="review-save"
      >
        <Text style={styles.saveLabel}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      gap: 12,
      padding: 20,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      opacity: 0.6,
      textTransform: 'uppercase',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    chipSelected: {
      backgroundColor: theme.accent,
    },
    chipLabel: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '500',
    },
    chipLabelSelected: {
      color: theme.onAccent,
    },
    input: {
      backgroundColor: theme.fill,
      borderRadius: 10,
      color: theme.textPrimary,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    save: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 14,
      marginTop: 12,
      paddingVertical: 16,
    },
    saveDisabled: {
      opacity: 0.4,
    },
    saveLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
