import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES, SEASONS, type Category, type Season } from '@/db/schema';

/** What Review commits — the derived-on-read stats are absent by design (§3.1). */
export type ReviewSubmission = {
  category: Category;
  name: string | null;
  brand: string | null;
  season: Season[] | null;
};

export type ReviewInitial = {
  category?: Category | null;
  name?: string | null;
  brand?: string | null;
  season?: Season[] | null;
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
 * §5.5 — Review & fill. **Category is the only required field** (chip picker,
 * the fixed six); name and brand are text, season is a four-value multi-select
 * with no "all-season" option. The screen owns only its form state and hands a
 * clean submission to its caller — the wizard saves it (§4.4), and edit mode
 * (§8) updates a row — which is exactly why it's a component with a single
 * entry point rather than two near-identical editors.
 */
export function ReviewForm({
  initial,
  submitLabel = 'Save',
  onSubmit,
}: {
  initial?: ReviewInitial;
  submitLabel?: string;
  onSubmit: (submission: ReviewSubmission) => void;
}) {
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [season, setSeason] = useState<Season[]>(initial?.season ?? []);

  const canSave = category !== null;

  function toggleSeason(value: Season) {
    setSeason((current) =>
      current.includes(value) ? current.filter((s) => s !== value) : [...current, value],
    );
  }

  function submit() {
    if (category === null) return;
    onSubmit({
      category,
      name: textToNullable(name),
      brand: textToNullable(brand),
      season: season.length > 0 ? season : null,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} testID="review-form">
      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((value) => {
          const selected = category === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(value)}
              style={[styles.chip, selected && styles.chipSelected]}
              testID={`category-chip-${value}`}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        placeholder="Optional"
        value={name}
        onChangeText={setName}
        style={styles.input}
        testID="review-name"
      />

      <Text style={styles.label}>Brand</Text>
      <TextInput
        placeholder="Optional"
        value={brand}
        onChangeText={setBrand}
        style={styles.input}
        testID="review-brand"
      />

      <Text style={styles.label}>Season</Text>
      <View style={styles.chips}>
        {SEASONS.map((value) => {
          const selected = season.includes(value);
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleSeason(value)}
              style={[styles.chip, selected && styles.chipSelected]}
              testID={`season-chip-${value}`}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {SEASON_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={submit}
        style={[styles.save, !canSave && styles.saveDisabled]}
        testID="review-save"
      >
        <Text style={styles.saveLabel}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    padding: 20,
  },
  label: {
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
    backgroundColor: '#eceaf2',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: '#3a2a6d',
  },
  chipLabel: {
    color: '#2a2440',
    fontSize: 15,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#f5f4f8',
    borderRadius: 10,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  save: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 16,
  },
  saveDisabled: {
    opacity: 0.4,
  },
  saveLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
