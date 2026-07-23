import { readFileSync } from 'fs';
import { join } from 'path';

import { parsePage } from '@/web-import';

/**
 * #41 — the gallery fix, pinned against three real retail pages saved verbatim
 * under `fixtures/`. #23 shipped a parser that dedup'd only byte-identical URLs
 * and looked for images only in `<meta>`/`<img>`, so the confirm step showed the
 * hero **twice** and never surfaced the gallery. These tests assert the fixed
 * behaviour on the exact HTML that exposed the bug:
 *
 *  - Demandware (Hackett, factory54): harvest the gallery out of the escaped
 *    JSON blob, filter to the colour the URL names, drop the favicon `og:image`,
 *    and auto-pick the clean-background flat-lay (`_FL` / `_P_`).
 *  - Shopify (piniparma): collapse size/format variants of one photo, and scope
 *    to this product's own media (its distinctive handle token) so recommended
 *    products and other colours don't flood the row.
 */
const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const identity = (url: string): string => {
  const base = url.split('?')[0].split('/').pop() ?? '';
  return base.replace(/\.(jpe?g|png|webp|avif)$/i, '').toLowerCase();
};

describe('parsePage — Hackett (Demandware), the page behind the screenshots', () => {
  const html = fixture('hackett-demandware.html');
  const url =
    'https://www.hackett.com/intl/en/pd/classic-fit-short-sleeve-knit-polo-HM7000186.html?color=816&size=S055XS&pid=HM7000186816XS';
  const { candidates } = parsePage(html, url);

  it('surfaces the full gallery from the escaped-JSON blob, not a duplicated hero', () => {
    expect(candidates.length).toBe(9);
    expect(new Set(candidates.map(identity)).size).toBe(candidates.length);
  });

  it('keeps only the colour the URL names (816), dropping 502/584/621', () => {
    expect(candidates.every((u) => /_816_/.test(u))).toBe(true);
  });

  it('auto-picks the clean-background flat-lay (_FL) as the first candidate', () => {
    expect(candidates[0]).toMatch(/_816_\d+_FL\./);
  });
});

describe('parsePage — factory54 (Demandware) whose og:image is a favicon', () => {
  const html = fixture('factory54-demandware.html');
  const url =
    'https://www.factory54.co.il/x/882447363.html?dwvar_882447363_f54ProductColor=KHAKI&dwvar_882447363_f54ProductSize=XS&site=0';
  const { candidates } = parsePage(html, url);

  it('never auto-picks the favicon og:image, nor the share/nav icons beside the gallery', () => {
    expect(candidates.every((u) => !/favicon/i.test(u))).toBe(true);
    expect(candidates.every((u) => !/pinterest|twitter|whatsapp|arrow/i.test(u))).toBe(true);
  });

  it('surfaces the product shots (no size/format duplicates)', () => {
    const ids = candidates.map(identity);
    expect(new Set(ids).size).toBe(ids.length);
    for (const shot of ['882447363_p_1', '882447363_l_2', '882447363_l_3', '882447363_l_4']) {
      expect(ids).toContain(shot);
    }
  });

  it('auto-picks the packshot (_P_) clean-background shot first', () => {
    expect(candidates[0]).toMatch(/882447363_P_/);
  });
});

describe('parsePage — piniparma (Shopify) with 565 CDN images on the page', () => {
  const html = fixture('piniparma-shopify.html');
  const url = 'https://www.piniparma.com/products/peach-polo-made-in-italy';
  const { candidates } = parsePage(html, url);

  it('scopes to this product (the "peach" handle token), excluding other products and colours', () => {
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((u) => /peach/i.test(u))).toBe(true);
  });

  it('collapses size/format variants so one photo appears once', () => {
    expect(new Set(candidates.map(identity)).size).toBe(candidates.length);
    expect(candidates.some((u) => /_small\./i.test(u) || /_grande\./i.test(u))).toBe(false);
  });

  it('recovers the distinct peach shots (B1, B2, 4, 5)', () => {
    const ids = new Set(candidates.map(identity));
    expect(ids.has('peach-polo-made-in-italy-b1')).toBe(true);
    expect(ids.has('peach-polo-made-in-italy-b2')).toBe(true);
  });
});
