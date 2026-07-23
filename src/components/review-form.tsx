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

function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
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
 * §5.5 — Review & fill. **Category is the only required field** (chip picker,
 * the fixed six); name and brand are text, season is a four-value multi-select
 * with no "all-season" option. The screen owns only its form state and hands a
 * clean submission to its caller — the wizard saves it (§4.4). Edit mode (§8)
 * will give this same component a second entry point when its ticket lands;
 * that's why persistence stays with the caller rather than living here.
 */
export function ReviewForm({ onSubmit }: { onSubmit: (submission: ReviewSubmission) => void }) {
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState<Season[]>([]);

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
        {CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={value}
            selected={category === value}
            onPress={() => setCategory(value)}
            testID={`category-chip-${value}`}
          />
        ))}
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
        {SEASONS.map((value) => (
          <Chip
            key={value}
            label={SEASON_LABELS[value]}
            selected={season.includes(value)}
            onPress={() => toggleSeason(value)}
            testID={`season-chip-${value}`}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={submit}
        style={[styles.save, !canSave && styles.saveDisabled]}
        testID="review-save"
      >
        <Text style={styles.saveLabel}>Save</Text>
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
