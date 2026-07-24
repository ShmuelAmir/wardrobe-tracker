import {
  classifyStatus,
  fetchProductPage,
  NO_IMAGE_MESSAGE,
  OFFLINE_MESSAGE,
  UNREACHABLE_MESSAGE,
} from '@/web-import';

const mockGetNetworkState = jest.fn();
jest.mock('expo-network', () => ({
  getNetworkStateAsync: () => mockGetNetworkState(),
}));

const online = { isConnected: true, isInternetReachable: true, type: 'WIFI' };

// A minimal Response stand-in — status, the resolved url, and the HTML body are
// all the orchestration reads.
function fakeResponse(status: number, { url = '', body = '' } = {}) {
  return { status, url, text: async () => body } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNetworkState.mockResolvedValue(online);
});

/**
 * §5.3 — the classification is derived from one rule, "would trying again
 * plausibly help?", not decided case-by-case: 5xx and 429 are retryable, the
 * anti-bot / not-found statuses are dead-ends, and 2xx is a page to parse.
 */
describe('classifyStatus', () => {
  it('treats 2xx as a page to parse', () => {
    expect(classifyStatus(200)).toBe('ok');
    expect(classifyStatus(204)).toBe('ok');
  });

  it('treats 5xx and 429 as retryable — trying again might help', () => {
    expect(classifyStatus(500)).toBe('retryable');
    expect(classifyStatus(503)).toBe('retryable');
    expect(classifyStatus(429)).toBe('retryable');
  });

  it('treats 401 / 403 / 404 as dead-ends — retrying the parser cannot help', () => {
    expect(classifyStatus(401)).toBe('dead-end');
    expect(classifyStatus(403)).toBe('dead-end');
    expect(classifyStatus(404)).toBe('dead-end');
  });
});

/**
 * §5.3 — the orchestration around the parse: an offline pre-flight, a 10s abort,
 * a cancel that is not an error, and the split between the retryable and
 * dead-end states on the fetch outcome.
 */
describe('fetchProductPage', () => {
  it('fires the offline retryable error immediately, without fetching', async () => {
    mockGetNetworkState.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    const fetchSpy = jest.spyOn(global, 'fetch');

    const outcome = await fetchProductPage('https://acme.com/p/coat');

    expect(outcome).toEqual({ status: 'retryable', message: OFFLINE_MESSAGE });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps a network failure to the unreachable retryable error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Network request failed'));

    const outcome = await fetchProductPage('https://acme.com/p/coat');

    expect(outcome).toEqual({ status: 'retryable', message: UNREACHABLE_MESSAGE });
  });

  it('aborts after the 10s timeout into the unreachable retryable error', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const pending = fetchProductPage('https://acme.com/p/coat');
    await Promise.resolve();
    jest.advanceTimersByTime(10_000);

    await expect(pending).resolves.toEqual({ status: 'retryable', message: UNREACHABLE_MESSAGE });
    jest.useRealTimers();
  });

  it('reports a caller cancel as cancelled, not as an error', async () => {
    const controller = new AbortController();
    jest.spyOn(global, 'fetch').mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const pending = fetchProductPage('https://acme.com/p/coat', { signal: controller.signal });
    await Promise.resolve();
    controller.abort();

    await expect(pending).resolves.toEqual({ status: 'cancelled' });
  });

  it('maps a 5xx to the retryable error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fakeResponse(503));

    const outcome = await fetchProductPage('https://acme.com/p/coat');

    expect(outcome).toEqual({ status: 'retryable', message: UNREACHABLE_MESSAGE });
  });

  it('maps a 403 to a dead-end carrying source_url but no parsed name/brand', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(fakeResponse(403, { url: 'https://acme.com/p/coat', body: 'nope' }));

    const outcome = await fetchProductPage('https://acme.com/p/coat');

    expect(outcome).toEqual({
      status: 'dead-end',
      message: NO_IMAGE_MESSAGE,
      sourceUrl: 'https://acme.com/p/coat',
      name: null,
      brand: null,
    });
  });

  it('maps a 200 with no usable image to a dead-end carrying the parsed name/brand', async () => {
    const html = `
      <meta property="og:title" content="Wool Overcoat | Acme" />
      <meta property="og:site_name" content="Acme" />
    `;
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(fakeResponse(200, { url: 'https://acme.com/p/coat', body: html }));

    const outcome = await fetchProductPage('https://acme.com/p/coat');

    expect(outcome).toEqual({
      status: 'dead-end',
      message: NO_IMAGE_MESSAGE,
      sourceUrl: 'https://acme.com/p/coat',
      name: 'Wool Overcoat',
      brand: 'Acme',
    });
  });

  it('returns the parse on a 200 that yields a usable image', async () => {
    const html = `<meta property="og:image" content="https://cdn.acme.com/coat.jpg" />`;
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(fakeResponse(200, { url: 'https://acme.com/p/coat', body: html }));

    const outcome = await fetchProductPage('https://acme.com/p/coat');

    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.result.candidates).toEqual(['https://cdn.acme.com/coat.jpg']);
      expect(outcome.result.sourceUrl).toBe('https://acme.com/p/coat');
    }
  });
});
