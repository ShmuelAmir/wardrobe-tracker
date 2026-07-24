import { fetchProductPage, isFetchableUrl, parsePage } from '@/web-import';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));

/**
 * §5.3 — URL validation is `http(s)` syntax only, "just enough to enable Fetch".
 * We deliberately do **not** try to detect "is this a product page": that's
 * step 3's job, not a regex's. So these rows only ever ask "is this a syntactic
 * http(s) URL?".
 */
describe('isFetchableUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isFetchableUrl('https://acme.com/coats/wool-overcoat')).toBe(true);
    expect(isFetchableUrl('http://acme.com')).toBe(true);
  });

  it('accepts a bare homepage — validation never judges "is this a product page"', () => {
    expect(isFetchableUrl('https://acme.com')).toBe(true);
  });

  it('rejects empty, non-URL, and non-http(s) schemes', () => {
    expect(isFetchableUrl('')).toBe(false);
    expect(isFetchableUrl('   ')).toBe(false);
    expect(isFetchableUrl('not a url')).toBe(false);
    expect(isFetchableUrl('ftp://acme.com/file')).toBe(false);
    expect(isFetchableUrl('acme.com')).toBe(false);
  });

  it('tolerates surrounding whitespace on an otherwise valid URL', () => {
    expect(isFetchableUrl('  https://acme.com/x  ')).toBe(true);
  });
});

/**
 * §5.3 — parse order is `og:image` → `twitter:image` → JSON-LD → largest `<img>`.
 * The first candidate is what step 3 auto-picks; the rest fill the thumbnail row
 * to swap among (all dedup'd, all absolute).
 */
describe('parsePage — image candidates', () => {
  const url = 'https://acme.com/p/wool-overcoat';

  it('auto-picks og:image as the first candidate', () => {
    const html = `
      <meta property="og:image" content="https://cdn.acme.com/hero.jpg" />
      <meta name="twitter:image" content="https://cdn.acme.com/tw.jpg" />
    `;
    const { candidates } = parsePage(html, url);
    expect(candidates[0]).toBe('https://cdn.acme.com/hero.jpg');
  });

  it('handles reversed attribute order (content before property)', () => {
    const html = `<meta content="https://cdn.acme.com/hero.jpg" property="og:image">`;
    expect(parsePage(html, url).candidates[0]).toBe('https://cdn.acme.com/hero.jpg');
  });

  it('falls back to twitter:image when there is no og:image', () => {
    const html = `<meta name="twitter:image" content="https://cdn.acme.com/tw.jpg">`;
    expect(parsePage(html, url).candidates[0]).toBe('https://cdn.acme.com/tw.jpg');
  });

  it('falls back to JSON-LD image when no og/twitter tags exist', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Wool Overcoat","image":["https://cdn.acme.com/ld1.jpg","https://cdn.acme.com/ld2.jpg"]}
      </script>`;
    const { candidates } = parsePage(html, url);
    expect(candidates).toEqual(['https://cdn.acme.com/ld1.jpg', 'https://cdn.acme.com/ld2.jpg']);
  });

  it('falls back to the largest <img> by width when nothing else is present', () => {
    const html = `
      <img src="https://cdn.acme.com/tiny.jpg" width="40" />
      <img src="https://cdn.acme.com/big.jpg" width="1200" />
      <img src="https://cdn.acme.com/mid.jpg" width="300" />`;
    const { candidates } = parsePage(html, url);
    expect(candidates[0]).toBe('https://cdn.acme.com/big.jpg');
  });

  it('resolves relative image URLs against the resolved page URL', () => {
    const html = `<meta property="og:image" content="/img/hero.jpg">`;
    expect(parsePage(html, url).candidates[0]).toBe('https://acme.com/img/hero.jpg');
  });

  it('decodes HTML entities in the image URL (&amp; → &)', () => {
    const html = `<meta property="og:image" content="https://cdn.acme.com/hero.jpg?w=800&amp;h=600">`;
    expect(parsePage(html, url).candidates[0]).toBe('https://cdn.acme.com/hero.jpg?w=800&h=600');
  });

  it('deduplicates candidates and keeps the priority order', () => {
    const html = `
      <meta property="og:image" content="https://cdn.acme.com/hero.jpg">
      <meta name="twitter:image" content="https://cdn.acme.com/hero.jpg">
      <img src="https://cdn.acme.com/hero.jpg" width="900">
      <img src="https://cdn.acme.com/alt.jpg" width="800">`;
    const { candidates } = parsePage(html, url);
    expect(candidates).toEqual(['https://cdn.acme.com/hero.jpg', 'https://cdn.acme.com/alt.jpg']);
  });
});

/**
 * §5.3 — "blank beats junk". `og:title` is rarely a clean product name, so we
 * split on `|`, `–`, `—`, drop any segment equal to `og:site_name`, take the
 * first survivor as Name and the site name as Brand — and leave Name blank
 * rather than store junk when nothing survives.
 */
describe('parsePage — name/brand cleanup', () => {
  const url = 'https://acme.com/p/wool-overcoat';

  it('splits og:title and takes the first clean segment as the name', () => {
    const html = `
      <meta property="og:title" content="Wool Overcoat | Acme — Free Shipping Over $50">
      <meta property="og:site_name" content="Acme">`;
    const { name, brand } = parsePage(html, url);
    expect(name).toBe('Wool Overcoat');
    expect(brand).toBe('Acme');
  });

  it('drops the segment matching og:site_name before choosing a name', () => {
    const html = `
      <meta property="og:title" content="Acme | Wool Overcoat">
      <meta property="og:site_name" content="Acme">`;
    expect(parsePage(html, url).name).toBe('Wool Overcoat');
  });

  it('leaves the name blank when every segment is the site name', () => {
    const html = `
      <meta property="og:title" content="Acme">
      <meta property="og:site_name" content="Acme">`;
    expect(parsePage(html, url).name).toBeNull();
  });

  it('leaves name and brand null when there is no metadata', () => {
    const { name, brand } = parsePage('<html></html>', url);
    expect(name).toBeNull();
    expect(brand).toBeNull();
  });
});

/**
 * §5.3 — `source_url` stores the **resolved** URL (`Response.url` after
 * redirects), so a shortened link imports as the durable product page. Only
 * when no fetch ever succeeds do we fall back to the pasted string.
 */
describe('fetchProductPage', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses the fetched HTML and stores the post-redirect URL as sourceUrl', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      url: 'https://acme.com/p/wool-overcoat', // resolved from a short link
      text: async () =>
        `<meta property="og:image" content="https://cdn.acme.com/hero.jpg">
         <meta property="og:title" content="Wool Overcoat | Acme">
         <meta property="og:site_name" content="Acme">`,
    }) as unknown as typeof fetch;

    const outcome = await fetchProductPage('https://acme.test/x9');

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.result.sourceUrl).toBe('https://acme.com/p/wool-overcoat');
    expect(outcome.result.candidates[0]).toBe('https://cdn.acme.com/hero.jpg');
    expect(outcome.result.name).toBe('Wool Overcoat');
    expect(outcome.result.brand).toBe('Acme');
  });

  it('resolves relative image URLs against the post-redirect URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      url: 'https://acme.com/p/wool-overcoat',
      text: async () => `<meta property="og:image" content="/img/hero.jpg">`,
    }) as unknown as typeof fetch;

    const outcome = await fetchProductPage('https://acme.test/x9');

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.result.candidates[0]).toBe('https://acme.com/img/hero.jpg');
  });
});
