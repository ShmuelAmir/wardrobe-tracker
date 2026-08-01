import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InOutfitsRail } from '@/components/in-outfits-rail';
import { ItemStatsStrip } from '@/components/item-stats-strip';
import { formatDay } from '@/date-format';
import { useItemDetail, useItemOutfits, useItemStats } from '@/db/queries';
import { SEASONS, type Season } from '@/db/schema';
import { itemImageUri } from '@/item-images';
import { sourceHostname } from '@/source-url';
import { useTheme, type Theme } from '@/theme';

/**
 * Item detail — the read-only page (§8.1). **An item is a place you go**: tapping
 * a Wardrobe grid cell lands here, and this screen adds no surfaces of its own —
 * Edit re-enters the §8.2 editor, and every outfit in the rail taps through to
 * its own detail. Everything shown is derived per §3 (no stored counters), and
 * there is deliberately **no delete** anywhere: the read path stays safe to
 * browse. Source is the one field that leaves the app, and only web-imported
 * items have one.
 */
export default function ItemDetailScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const router = useRouter();
  const { item, loading } = useItemDetail(itemId);
  const stats = useItemStats(itemId);
  const outfits = useItemOutfits(itemId);

  if (loading) return <View testID="item-detail-loading" />;

  if (item === null) {
    return (
      <View style={styles.missing} testID="item-detail-missing">
        <Text style={styles.missingText}>This item no longer exists.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: item.category,
          headerBackTitle: 'Wardrobe',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              // Edit re-enters §8.2's editor — the wizard's own Review screen in
              // Edit mode — rather than opening a surface of its own (§5.5).
              onPress={() => router.push(`/item/${itemId}/edit`)}
              testID="item-edit"
            >
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} testID="item-detail">
        <ItemHero imageFile={item.imageFile} category={item.category} styles={styles} />

        <View style={styles.identity}>
          {item.name ? <Text style={styles.name}>{item.name}</Text> : null}
          {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
        </View>

        <ItemStatsStrip stats={stats} outfitsCount={outfits.length} />

        <View style={styles.fields}>
          <Field label="Category" value={item.category} testID="item-field-category" styles={styles} />
          <Field
            label="Season"
            value={formatSeason(item.season)}
            testID="item-field-season"
            divided
            styles={styles}
          />
          <Field
            label="Added"
            value={formatDay(item.createdAt)}
            testID="item-field-added"
            divided
            styles={styles}
          />
          {item.sourceUrl ? (
            <View style={[styles.field, styles.fieldDivided]}>
              <Text style={styles.fieldLabel}>Source</Text>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => Linking.openURL(item.sourceUrl!)}
                testID="item-source"
              >
                <Text style={styles.link}>{sourceHostname(item.sourceUrl)}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.railHeader}>
          <Text style={styles.railHeading}>In outfits</Text>
          <Text style={styles.railCount}>{outfits.length}</Text>
        </View>
        <InOutfitsRail outfits={outfits} onPressOutfit={(outfitId) => router.push(`/outfit/${outfitId}`)} />
      </ScrollView>
    </View>
  );
}

/**
 * The hero degrades exactly as the grid tile does: a missing file renders a
 * category placeholder, never a broken image (§8.1). `cover` for the same reason
 * the grid uses it — expo-image's decode-time downscale is what lets the app
 * store no thumbnails (§10.8).
 */
function ItemHero({
  imageFile,
  category,
  styles,
}: {
  imageFile: string;
  category: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <View style={[styles.hero, styles.heroPlaceholder]} testID="item-hero-placeholder">
        <Text style={styles.heroPlaceholderLabel}>{category}</Text>
      </View>
    );
  }

  return (
    <Image
      testID="item-hero-image"
      source={itemImageUri(imageFile)}
      contentFit="cover"
      style={styles.hero}
      onError={() => setMissing(true)}
    />
  );
}

function Field({
  label,
  value,
  testID,
  divided,
  styles,
}: {
  label: string;
  value: string;
  testID: string;
  divided?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.field, divided && styles.fieldDivided]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/**
 * §8.1 Season field — `Any season` when null (unset, *not* year-round, §3.1 rule
 * 2). A set renders in the canonical `SEASONS` order rather than storage order,
 * so "spring + winter" always reads "Spring, Winter".
 */
function formatSeason(season: Season[] | null): string {
  if (season === null || season.length === 0) return 'Any season';
  return SEASONS.filter((s) => season.includes(s))
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(', ');
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    content: {
      gap: 18,
      paddingBottom: 32,
    },
    hero: {
      aspectRatio: 1,
      borderRadius: 16,
      marginHorizontal: 20,
    },
    heroPlaceholder: {
      alignItems: 'center',
      backgroundColor: theme.fill,
      justifyContent: 'center',
    },
    heroPlaceholderLabel: {
      color: theme.textSecondary,
      fontSize: 16,
      opacity: 0.55,
    },
    identity: {
      gap: 4,
      paddingHorizontal: 20,
    },
    name: {
      color: theme.textPrimary,
      fontSize: 24,
      fontWeight: '700',
    },
    brand: {
      color: theme.textSecondary,
      fontSize: 14,
      opacity: 0.6,
    },
    fields: {
      backgroundColor: theme.fill,
      borderRadius: 12,
      marginHorizontal: 20,
      overflow: 'hidden',
    },
    field: {
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    fieldDivided: {
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    fieldLabel: {
      color: theme.textSecondary,
      fontSize: 15,
      opacity: 0.55,
      width: 96,
    },
    fieldValue: {
      color: theme.textPrimary,
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'right',
    },
    link: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'right',
    },
    railHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    railHeading: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    railCount: {
      color: theme.textTertiary,
      fontSize: 13,
      fontWeight: '600',
    },
    edit: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: '600',
    },
    missing: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    missingText: {
      color: theme.textSecondary,
      fontSize: 16,
      opacity: 0.6,
    },
  });
}
