import { getTheme, type Theme } from '@/theme';

/**
 * WCAG AA contrast guards for foreground/background role *pairs* (#78, §1.5).
 * Sibling of `theme.test.ts`: that file guards the shape of the role set, this
 * one guards that a pair is legible once resolved.
 *
 * Two kinds of entry qualify. Most are pairs a real component paints today, and
 * the comment on each says where. A few guard a role that is currently
 * *unclaimed* but still in the set, held to the bar on the surface its
 * definition names so it is safe for the next author to reach for — an
 * unclaimed role that fails AA is a trap, not a spare part (#85).
 *
 * It asserts a *ratio*, never a hex — a color stays an implementation detail
 * tuned on-device, but "this text is readable on that block" is a property the
 * palette owes us in both themes. A nudge to a primitive is free as long as the
 * pair still clears the bar; dropping below it fails here instead of shipping.
 *
 * The bar is 4.5:1 (AA normal text) because every pair below is small text —
 * 13–15px body and subtitles, none of them large-scale.
 */

/**
 * Relative luminance per WCAG 2.1, from a `#rrggbb` literal. Opaque only — a
 * ratio against a translucent role (`scrim`) isn't defined without knowing what
 * is behind it, so such a pair fails loudly here rather than scoring garbage.
 */
function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`not an opaque #rrggbb color: ${hex}`);

  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** The WCAG contrast ratio between two opaque colors, 1:1 … 21:1. */
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const AA_NORMAL = 4.5;

/** The single-color roles — `heroGradient` resolves to stops, not a pair half. */
type ColorRole = Exclude<keyof Theme, 'heroGradient'>;

// Each entry: a pair named by role, with where it is painted (or, for an
// unclaimed role, the surface its definition names).
const PAIRS: { where: string; fg: ColorRole; bg: ColorRole }[] = [
  // add-item `index.tsx` primary tile — the sole consumer of `onAccentMuted`,
  // the role minted with no prototype source (#65) and verified here (#78).
  { where: 'add-item primary-tile subtitle', fg: 'onAccentMuted', bg: 'accent' },
  { where: 'add-item primary-tile title', fg: 'onAccent', bg: 'accent' },
  // add-item `paste-link.tsx` retryable-error text, retargeted off `warning`
  // (which measured ~4.1:1 light) onto `danger` in #78.
  { where: 'paste-link error text', fg: 'danger', bg: 'background' },
  { where: 'destructive row label', fg: 'danger', bg: 'surface' },
  // stats-row's "never worn" `0` badge — 13px at weight 600, normal text, so the
  // 4.5 bar applies. Sat at ~3.96:1 light until #85 deepened `amber700`.
  { where: 'never-worn count badge', fg: 'onWarningSurface', bg: 'warningSurface' },
  // `warning` has no consumer today (#78 moved its one to `danger`) but stays
  // claimable, so it is held to the bar on `background` — the surface its own
  // definition names — rather than left as a trap for whoever claims it (#85).
  { where: 'standalone warning text (unclaimed role)', fg: 'warning', bg: 'background' },
];

describe('paired roles clear WCAG AA in both themes', () => {
  for (const { where, fg, bg } of PAIRS) {
    it.each(['light', 'dark'] as const)(`${where}: ${fg} on ${bg} in %s`, (scheme) => {
      const theme = getTheme(scheme);

      expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});
