import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import ConfirmImageStep from '@/app/add-item/confirm-image';
import PasteLinkStep from '@/app/add-item/paste-link';
import ReviewStep from '@/app/add-item/review';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  // The steps below are always given the draft state they need, so Redirect is
  // never exercised; a light stand-in keeps the modules importable.
  Redirect: () => null,
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'a3f2c1de' }));

// expo-image's <Image> is a native view; a testID-preserving stand-in lets the
// preview and thumbnails be queried without a real decoder.
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

const mockFetchProductPage = jest.fn();
jest.mock('@/web-import', () => {
  const actual = jest.requireActual('@/web-import');
  return { ...actual, fetchProductPage: (...args: unknown[]) => mockFetchProductPage(...args) };
});

const mockDownloadCandidate = jest.fn();
jest.mock('@/web-download', () => ({
  downloadCandidate: (...args: unknown[]) => mockDownloadCandidate(...args),
}));

// The photo fallback (dead-end / "None of these") launches these; mocking the
// launchers lets the flow drive a capture without a real picker.
const mockCaptureFromCamera = jest.fn();
const mockCaptureFromLibrary = jest.fn();
jest.mock('@/photo-capture', () => ({
  captureFromCamera: () => mockCaptureFromCamera(),
  captureFromLibrary: () => mockCaptureFromLibrary(),
}));

const mockSaveItem = jest.fn();
jest.mock('@/item-save', () => ({ saveItem: (...args: unknown[]) => mockSaveItem(...args) }));

const mockSetWebImport = jest.fn();
const mockSetCapture = jest.fn();
let mockCapture: unknown = null;
let mockWebImport: unknown = null;
jest.mock('@/components/add-item-draft', () => ({
  useAddItemDraft: () => ({
    capture: mockCapture,
    setCapture: mockSetCapture,
    webImport: mockWebImport,
    setWebImport: mockSetWebImport,
    reset: jest.fn(),
  }),
}));

const aParse = (overrides = {}) => ({
  candidates: ['https://cdn.acme.com/hero.jpg', 'https://cdn.acme.com/alt.jpg'],
  sourceUrl: 'https://acme.com/p/wool-overcoat',
  name: 'Wool Overcoat',
  brand: 'Acme',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture = null;
  mockWebImport = null;
});

/**
 * §5.3 — step 2 is fetch-HTML-and-parse only: Fetch lights up on `http(s)`
 * syntax alone, a successful fetch drops the parse in the draft and walks to
 * step 3, and while it runs there's an inline spinner with no full-screen
 * loading state.
 */
describe('paste-link step', () => {
  it('keeps Fetch disabled until the URL is valid http(s) syntax', async () => {
    const user = userEvent.setup();
    await render(<PasteLinkStep />);

    expect(screen.getByTestId('paste-link-fetch').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await user.type(screen.getByTestId('paste-link-url'), 'https://acme.com/p/wool-overcoat');

    expect(screen.getByTestId('paste-link-fetch').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('enables Fetch for a bare homepage — validation never judges the path', async () => {
    const user = userEvent.setup();
    await render(<PasteLinkStep />);

    await user.type(screen.getByTestId('paste-link-url'), 'https://acme.com');

    expect(screen.getByTestId('paste-link-fetch').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('fetches, stores the parse in the draft, and advances to confirm-image', async () => {
    mockFetchProductPage.mockResolvedValueOnce({ status: 'ok', result: aParse() });
    const user = userEvent.setup();
    await render(<PasteLinkStep />);

    await user.type(screen.getByTestId('paste-link-url'), 'https://acme.test/x9');
    await user.press(screen.getByTestId('paste-link-fetch'));

    await waitFor(() =>
      expect(mockFetchProductPage).toHaveBeenCalledWith('https://acme.test/x9', expect.anything()),
    );
    expect(mockSetWebImport).toHaveBeenCalledWith(aParse());
    expect(mockPush).toHaveBeenCalledWith('/add-item/confirm-image');
  });
});

/**
 * §5.3 — the two failure states split on the user's **next action**, not the
 * diagnosis. Retryable keeps the field editable and promotes Retry; the dead-end
 * withholds Retry but offers the photo fallback, keeps the field editable, and
 * seeds the draft so nothing typed or parsed is thrown away.
 */
describe('paste-link step — failure states', () => {
  async function fetchWith(outcome: unknown) {
    mockFetchProductPage.mockResolvedValueOnce(outcome);
    const user = userEvent.setup();
    await render(<PasteLinkStep />);
    await user.type(screen.getByTestId('paste-link-url'), 'https://acme.test/x9');
    await user.press(screen.getByTestId('paste-link-fetch'));
    return user;
  }

  it('shows the retryable error and relabels the button Retry, field still editable', async () => {
    await fetchWith({ status: 'retryable', message: "You're offline. Reconnect and try again." });

    await waitFor(() =>
      expect(screen.getByTestId('paste-link-error')).toHaveTextContent(
        "You're offline. Reconnect and try again.",
      ),
    );
    expect(screen.getByTestId('paste-link-fetch')).toHaveTextContent('Retry');
    expect(screen.getByTestId('paste-link-url').props.editable).toBe(true);
    // Retryable never reaches Review, so no metadata is carried and nowhere is navigated.
    expect(mockSetWebImport).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // No photo fallback on the retryable state.
    expect(screen.queryByTestId('photo-fallback')).toBeNull();
  });

  it('offers the photo fallback on a dead-end with no Retry, field and Fetch still live', async () => {
    await fetchWith({
      status: 'dead-end',
      message: "Couldn't get an image from that page.",
      sourceUrl: 'https://acme.com/p/wool-overcoat',
      name: 'Wool Overcoat',
      brand: 'Acme',
    });

    // The parse's source_url + name/brand are seeded so the fallback carries them.
    await waitFor(() =>
      expect(mockSetWebImport).toHaveBeenCalledWith({
        candidates: [],
        sourceUrl: 'https://acme.com/p/wool-overcoat',
        name: 'Wool Overcoat',
        brand: 'Acme',
      }),
    );
    expect(screen.getByTestId('photo-fallback')).toBeOnTheScreen();
    // No Retry: the button stays Fetch, and the field stays editable (the 403 hatch).
    expect(screen.getByTestId('paste-link-fetch')).toHaveTextContent('Fetch');
    expect(screen.getByTestId('paste-link-url').props.editable).toBe(true);
  });

  it('carries source_url to Review when a photo is taken from the dead-end — no restart', async () => {
    mockCaptureFromCamera.mockResolvedValueOnce({
      status: 'captured',
      capture: { uri: 'file:///cache/shot.jpg', width: 3024, height: 4032, uuid: 'a3f2c1de' },
    });
    const user = await fetchWith({
      status: 'dead-end',
      message: "Couldn't get an image from that page.",
      sourceUrl: 'https://acme.com/p/wool-overcoat',
      name: 'Wool Overcoat',
      brand: 'Acme',
    });

    await waitFor(() => expect(screen.getByTestId('photo-fallback')).toBeOnTheScreen());
    await user.press(screen.getByTestId('fallback-camera'));

    await waitFor(() =>
      expect(mockSetCapture).toHaveBeenCalledWith({
        uri: 'file:///cache/shot.jpg',
        width: 3024,
        height: 4032,
        uuid: 'a3f2c1de',
      }),
    );
    // Continues to Review (§5.3) — it does not restart the wizard at step 1.
    expect(mockPush).toHaveBeenLastCalledWith('/add-item/review');
  });

  it('restores an editable field when the in-flight fetch is cancelled', async () => {
    // Resolve only when the caller aborts — the same signal the 10s timeout uses.
    mockFetchProductPage.mockImplementationOnce(
      (_url: string, { signal }: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve({ status: 'cancelled' }));
        }),
    );
    const user = userEvent.setup();
    await render(<PasteLinkStep />);
    await user.type(screen.getByTestId('paste-link-url'), 'https://acme.test/x9');
    await user.press(screen.getByTestId('paste-link-fetch'));

    // While fetching, the field is disabled and Cancel is offered.
    expect(screen.getByTestId('paste-link-url').props.editable).toBe(false);
    await user.press(screen.getByTestId('paste-link-cancel'));

    // Cancel restores the editable field and surfaces no error.
    await waitFor(() => expect(screen.getByTestId('paste-link-url').props.editable).toBe(true));
    expect(screen.queryByTestId('paste-link-error')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

/**
 * §5.1 / §5.4 — step 3 auto-picks the first candidate, lets the thumbnail row
 * swap among the rest, and on "Use this image" downloads the chosen one into
 * cache under a fresh UUID before walking to Review.
 */
describe('confirm-image step', () => {
  beforeEach(() => {
    mockWebImport = aParse();
    mockDownloadCandidate.mockResolvedValue({
      uri: 'file:///cache/a3f2c1de.jpg',
      width: 1200,
      height: 1600,
      uuid: 'a3f2c1de',
    });
  });

  it('downloads the auto-picked candidate and advances to Review', async () => {
    const user = userEvent.setup();
    await render(<ConfirmImageStep />);

    await user.press(screen.getByTestId('confirm-image-use'));

    await waitFor(() =>
      expect(mockDownloadCandidate).toHaveBeenCalledWith(
        'https://cdn.acme.com/hero.jpg',
        'a3f2c1de',
      ),
    );
    expect(mockSetCapture).toHaveBeenCalledWith({
      uri: 'file:///cache/a3f2c1de.jpg',
      width: 1200,
      height: 1600,
      uuid: 'a3f2c1de',
    });
    expect(mockPush).toHaveBeenCalledWith('/add-item/review');
  });

  it('downloads a swapped-to candidate after tapping its thumbnail', async () => {
    const user = userEvent.setup();
    await render(<ConfirmImageStep />);

    await user.press(screen.getByTestId('confirm-image-thumb-1'));
    await user.press(screen.getByTestId('confirm-image-use'));

    await waitFor(() =>
      expect(mockDownloadCandidate).toHaveBeenCalledWith(
        'https://cdn.acme.com/alt.jpg',
        'a3f2c1de',
      ),
    );
  });

  it('drops into the photo fallback on "None of these", carrying source_url to Review', async () => {
    mockCaptureFromLibrary.mockResolvedValueOnce({
      status: 'captured',
      capture: { uri: 'file:///cache/pick.jpg', width: 1200, height: 1600, uuid: 'a3f2c1de' },
    });
    const user = userEvent.setup();
    await render(<ConfirmImageStep />);

    await user.press(screen.getByTestId('confirm-image-none'));
    expect(screen.getByTestId('photo-fallback')).toBeOnTheScreen();
    await user.press(screen.getByTestId('fallback-library'));

    await waitFor(() => expect(mockSetCapture).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith('/add-item/review');
    // The successful parse's draft (source_url + name/brand) is untouched — the
    // fallback reuses it rather than re-seeding, so Review still reads it.
    expect(mockSetWebImport).not.toHaveBeenCalled();
  });

  it('routes a failed download into the same fallback — no new error screen', async () => {
    mockDownloadCandidate.mockReset();
    mockDownloadCandidate.mockRejectedValueOnce(new Error('download failed'));
    const user = userEvent.setup();
    await render(<ConfirmImageStep />);

    await user.press(screen.getByTestId('confirm-image-use'));

    await waitFor(() => expect(screen.getByTestId('photo-fallback')).toBeOnTheScreen());
    // The same branch, not a distinct error state.
    expect(screen.queryByTestId('paste-link-error')).toBeNull();
  });
});

/**
 * §5.3 — Review on the web path pre-fills Name from the cleaned title and Brand
 * from the site name, and carries the resolved `source_url` into the saved row.
 */
describe('review step — web import', () => {
  beforeEach(() => {
    mockCapture = { uri: 'file:///cache/a3f2c1de.jpg', width: 1200, height: 1600, uuid: 'a3f2c1de' };
    mockWebImport = aParse();
  });

  it('pre-fills the cleaned name and site brand, and saves the resolved source URL', async () => {
    mockSaveItem.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    await render(<ReviewStep />);

    expect(screen.getByTestId('review-name').props.value).toBe('Wool Overcoat');
    expect(screen.getByTestId('review-brand').props.value).toBe('Acme');

    await user.press(screen.getByTestId('category-chip-Outerwear'));
    await user.press(screen.getByTestId('review-save'));

    await waitFor(() =>
      expect(mockSaveItem).toHaveBeenCalledWith(
        { uri: 'file:///cache/a3f2c1de.jpg', width: 1200, height: 1600, uuid: 'a3f2c1de' },
        {
          category: 'Outerwear',
          name: 'Wool Overcoat',
          brand: 'Acme',
          season: null,
          sourceUrl: 'https://acme.com/p/wool-overcoat',
        },
      ),
    );
  });

  it('leaves Name blank when the title cleaned to nothing — junk is not stored', async () => {
    mockWebImport = aParse({ name: null, brand: 'Acme' });
    await render(<ReviewStep />);

    expect(screen.getByTestId('review-name').props.value).toBe('');
    expect(screen.getByTestId('review-brand').props.value).toBe('Acme');
  });
});
