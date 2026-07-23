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
    mockFetchProductPage.mockResolvedValueOnce(aParse());
    const user = userEvent.setup();
    await render(<PasteLinkStep />);

    await user.type(screen.getByTestId('paste-link-url'), 'https://acme.test/x9');
    await user.press(screen.getByTestId('paste-link-fetch'));

    await waitFor(() => expect(mockFetchProductPage).toHaveBeenCalledWith('https://acme.test/x9'));
    expect(mockSetWebImport).toHaveBeenCalledWith(aParse());
    expect(mockPush).toHaveBeenCalledWith('/add-item/confirm-image');
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
