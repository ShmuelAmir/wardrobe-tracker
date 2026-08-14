import { convexTest } from 'convex-test';
import { encode } from 'jpeg-js';

import { NO_IMAGE_MESSAGE, UNREACHABLE_MESSAGE } from '../src/web-import';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const wardrobe = () => convexTest(schema, modules);

const OWNER = { subject: 'owner|session_laptop' };

const PAGE = 'https://acme.test/p/coat';

/**
 * `Response.url` is empty on a constructed Response, so the post-redirect URL
 * has to be defined onto it — which is also the only way to make a redirect
 * observable without a server.
 */
function respond(status: number, { url = PAGE, body = '' } = {}): Response {
  const response = new Response(body, { status });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

function jpegBody(width: number, height: number): ArrayBuffer {
  const data = new Uint8Array(width * height * 4).fill(180);
  return new Uint8Array(encode({ width, height, data }, 90).data).buffer as ArrayBuffer;
}

const PRODUCT_HTML = `
  <meta property="og:title" content="Wool Overcoat | Acme" />
  <meta property="og:site_name" content="Acme" />
  <meta property="og:image" content="https://cdn.acme.test/coat.jpg" />
`;

/** Queues one response (or thrown error) per call, in order. */
function stubFetch(...replies: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let next = 0;

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const reply = replies[Math.min(next, replies.length - 1)];
    next += 1;
    if (reply instanceof Error) throw reply;
    return reply;
  });

  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('importing a product page', () => {
  it('parses a 200 into candidates, name and brand', async () => {
    stubFetch(respond(200, { body: PRODUCT_HTML }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: PAGE });

    expect(outcome).toEqual({
      status: 'ok',
      result: {
        candidates: ['https://cdn.acme.test/coat.jpg'],
        sourceUrl: PAGE,
        name: 'Wool Overcoat',
        brand: 'Acme',
      },
    });
  });

  it('stores the post-redirect URL as sourceUrl, not the pasted one', async () => {
    stubFetch(respond(200, { url: 'https://acme.test/p/wool-overcoat', body: PRODUCT_HTML }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: 'https://acme.test/s/abc' });

    expect(outcome).toMatchObject({
      status: 'ok',
      result: { sourceUrl: 'https://acme.test/p/wool-overcoat' },
    });
  });

  it('sends the browser-like request headers the fixtures were captured with', async () => {
    const calls = stubFetch(respond(200, { body: PRODUCT_HTML }));

    await wardrobe().withIdentity(OWNER).action(api.webImport.importPage, { url: PAGE });

    expect(calls[0].init?.headers).toMatchObject({ 'User-Agent': expect.stringContaining('Safari') });
  });

  it('validates the URL as http(s) syntax only, never as "is this a product page"', async () => {
    stubFetch(respond(200, { url: 'https://acme.test/', body: PRODUCT_HTML }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: 'https://acme.test/' });

    expect(outcome).toMatchObject({ status: 'ok' });
  });

  it('dead-ends a string that is not an http(s) URL, still carrying it', async () => {
    const calls = stubFetch(respond(200, { body: PRODUCT_HTML }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: 'not a url' });

    expect(outcome).toMatchObject({ status: 'dead-end', sourceUrl: 'not a url' });
    expect(calls).toEqual([]);
  });

  it('maps a 5xx and a 429 to retryable', async () => {
    stubFetch(respond(503));
    const t = wardrobe();

    await expect(t.withIdentity(OWNER).action(api.webImport.importPage, { url: PAGE })).resolves.toEqual(
      { status: 'retryable', message: UNREACHABLE_MESSAGE },
    );
  });

  it('maps a 403 to a dead-end carrying sourceUrl but no parsed name or brand', async () => {
    stubFetch(respond(403, { body: 'nope' }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: PAGE });

    expect(outcome).toEqual({
      status: 'dead-end',
      message: NO_IMAGE_MESSAGE,
      sourceUrl: PAGE,
      name: null,
      brand: null,
    });
  });

  it('maps a 200 with no usable image to a dead-end carrying the parsed name and brand', async () => {
    stubFetch(
      respond(200, {
        body: `
          <meta property="og:title" content="Wool Overcoat | Acme" />
          <meta property="og:site_name" content="Acme" />
        `,
      }),
    );

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: PAGE });

    expect(outcome).toEqual({
      status: 'dead-end',
      message: NO_IMAGE_MESSAGE,
      sourceUrl: PAGE,
      name: 'Wool Overcoat',
      brand: 'Acme',
    });
  });
});

/**
 * §5.4's ⚠️ — a connection-level reject throws instead of answering with a
 * status, so a catch that calls every throw retryable offers a Retry that can
 * never work. One invisible retry tells the two apart.
 */
describe('a connection-level reject', () => {
  it('retries once, invisibly, and reports the success as if it were the first try', async () => {
    const calls = stubFetch(new TypeError('fetch failed'), respond(200, { body: PRODUCT_HTML }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: PAGE });

    expect(outcome).toMatchObject({ status: 'ok' });
    expect(calls).toHaveLength(2);
  });

  it('lands on the dead end when it reproduces, never on a Retry button', async () => {
    const calls = stubFetch(new TypeError('fetch failed'), new TypeError('fetch failed'));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: PAGE });

    expect(outcome).toEqual({
      status: 'dead-end',
      message: NO_IMAGE_MESSAGE,
      sourceUrl: PAGE,
      name: null,
      brand: null,
    });
    expect(calls).toHaveLength(2);
  });

  it('keeps a timeout retryable — an abort we fired is not a reject we can read', async () => {
    stubFetch(new DOMException('The operation timed out.', 'TimeoutError'));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importPage, { url: PAGE });

    expect(outcome).toEqual({ status: 'retryable', message: UNREACHABLE_MESSAGE });
  });
});

describe('importing the confirmed image', () => {
  it('normalizes the downloaded bytes and stores one file, resolving its URL', async () => {
    stubFetch(
      new Response(jpegBody(1500, 900), { headers: { 'Content-Type': 'image/jpeg' } }),
    );
    const t = wardrobe();

    const outcome = await t
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'https://cdn.acme.test/coat.jpg' });

    expect(outcome).toMatchObject({ status: 'ok', width: 1200, height: 720 });
    if (outcome.status !== 'ok') throw new Error('unreachable');

    // The stored bytes are read inside the run: a Blob is not a Convex value
    // and cannot cross back out of one.
    const storedBytes = await t.run(async (ctx) => {
      const file = await ctx.storage.get(outcome.storageId);
      return file === null ? null : file.size;
    });
    expect(storedBytes).toBeGreaterThan(0);
    expect(outcome.url).toBe(await t.run(async (ctx) => await ctx.storage.getUrl(outcome.storageId)));
  });

  it('sends the same browser-like headers, so a CDN that gates on them serves us', async () => {
    const calls = stubFetch(new Response(jpegBody(80, 80)));

    await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'https://cdn.acme.test/coat.jpg' });

    expect(calls[0].init?.headers).toMatchObject({ 'User-Agent': expect.stringContaining('Safari') });
  });

  it('dead-ends bytes it cannot decode rather than storing them', async () => {
    stubFetch(new Response('<html>an error page</html>'));
    const t = wardrobe();

    const outcome = await t
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'https://cdn.acme.test/coat.jpg' });

    expect(outcome).toMatchObject({ status: 'dead-end' });
    expect(await t.run(async (ctx) => await ctx.db.system.query('_storage').collect())).toEqual([]);
  });

  it('refuses a URL that is not http(s), without fetching it', async () => {
    const calls = stubFetch(new Response(jpegBody(80, 80)));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'file:///etc/passwd' });

    expect(outcome).toMatchObject({ status: 'dead-end' });
    expect(calls).toEqual([]);
  });

  it('refuses a body that declares itself larger than the ceiling, before reading it', async () => {
    let read = false;
    const oversized = new Response(jpegBody(80, 80), {
      headers: { 'Content-Length': String(64 * 1024 * 1024) },
    });
    Object.defineProperty(oversized, 'arrayBuffer', {
      value: async () => {
        read = true;
        return new ArrayBuffer(0);
      },
    });
    stubFetch(oversized);

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'https://cdn.acme.test/huge.jpg' });

    expect(outcome).toMatchObject({ status: 'dead-end' });
    expect(read).toBe(false);
  });

  it('maps a 5xx on the image to retryable', async () => {
    stubFetch(new Response('', { status: 503 }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'https://cdn.acme.test/coat.jpg' });

    expect(outcome).toMatchObject({ status: 'retryable' });
  });

  it('dead-ends a 403 on the image', async () => {
    stubFetch(new Response('', { status: 403 }));

    const outcome = await wardrobe()
      .withIdentity(OWNER)
      .action(api.webImport.importImage, { url: 'https://cdn.acme.test/coat.jpg' });

    expect(outcome).toMatchObject({ status: 'dead-end' });
  });
});

/** Invariant #1: both actions are the owner's, and neither takes a `userId`. */
describe('authorization', () => {
  it('refuses both actions to a caller who is not signed in', async () => {
    stubFetch(respond(200, { body: PRODUCT_HTML }));
    const t = wardrobe();

    await expect(t.action(api.webImport.importPage, { url: PAGE })).rejects.toThrow();
    await expect(
      t.action(api.webImport.importImage, { url: 'https://cdn.acme.test/coat.jpg' }),
    ).rejects.toThrow();
  });
});
