import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import SourceStep from '@/app/add-item/index';
import ReviewStep from '@/app/add-item/review';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  // ReviewStep renders <Redirect> only when there is no capture; the tests below
  // always provide one, so a light stand-in keeps the module importable.
  Redirect: () => null,
}));

const mockLaunch = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunch(...args),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'a3f2c1de' }));

const mockSetCapture = jest.fn();
let mockCapture: unknown = null;
let mockSourceUrl: string | null = null;
jest.mock('@/components/add-item-draft', () => ({
  useAddItemDraft: () => ({
    capture: mockCapture,
    sourceUrl: mockSourceUrl,
    setCapture: mockSetCapture,
    reset: jest.fn(),
  }),
}));

const mockSaveItem = jest.fn();
jest.mock('@/item-save', () => ({ saveItem: (...args: unknown[]) => mockSaveItem(...args) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture = null;
  mockSourceUrl = null;
});

/**
 * §5.1 — the source step lists all three sources; only the library is wired in
 * this slice. Choosing a photo mints the UUID at capture (§4.2) and walks
 * forward to confirm, carrying the picked file — it never restarts (§5).
 */
describe('source step — choose from library', () => {
  it('lists all three sources, with Import from web the primary one', async () => {
    await render(<SourceStep />);

    expect(screen.getByTestId('source-web')).toBeOnTheScreen();
    expect(screen.getByTestId('source-camera')).toBeOnTheScreen();
    expect(screen.getByTestId('source-library')).toBeOnTheScreen();
    // Web is primary; camera is inert this slice. Both are non-pressable here,
    // so only the library advances.
    expect(screen.getByText('Import from web')).toBeOnTheScreen();
    expect(screen.getByTestId('source-web').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('source-library').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('captures the picked photo under a fresh UUID and advances to confirm', async () => {
    mockLaunch.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/pick.jpg', width: 4032, height: 3024 }],
    });
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-library'));

    await waitFor(() =>
      expect(mockSetCapture).toHaveBeenCalledWith({
        uri: 'file:///cache/pick.jpg',
        width: 4032,
        height: 3024,
        uuid: 'a3f2c1de',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/add-item/confirm');
  });

  it('does nothing when the picker is canceled', async () => {
    mockLaunch.mockResolvedValueOnce({ canceled: true, assets: null });
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-library'));

    await waitFor(() => expect(mockLaunch).toHaveBeenCalled());
    expect(mockSetCapture).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

/**
 * §5.5 / §4.4 — Review commits through the save pipeline, then the wizard
 * advances to Saved. The captured image and the draft's `source_url` are what
 * the form's fields join to become a row.
 */
describe('review step — commit', () => {
  beforeEach(() => {
    mockCapture = { uri: 'file:///cache/pick.jpg', width: 800, height: 600, uuid: 'a3f2c1de' };
  });

  it('saves the captured image with the chosen fields, then shows Saved', async () => {
    mockSaveItem.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    await render(<ReviewStep />);

    await user.press(screen.getByTestId('category-chip-Top'));
    await user.press(screen.getByTestId('review-save'));

    await waitFor(() =>
      expect(mockSaveItem).toHaveBeenCalledWith(
        { uri: 'file:///cache/pick.jpg', width: 800, height: 600, uuid: 'a3f2c1de' },
        { category: 'Top', name: null, brand: null, season: null, sourceUrl: null },
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/add-item/saved');
  });

  it('stays on the form when the save fails — nothing is lost', async () => {
    mockSaveItem.mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    await render(<ReviewStep />);

    await user.press(screen.getByTestId('category-chip-Top'));
    await user.press(screen.getByTestId('review-save'));

    await waitFor(() => expect(mockSaveItem).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
