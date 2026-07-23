import { downloadCandidate } from '@/web-download';

const mockDownloads: { url: string; dest: string; options: unknown }[] = [];
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    static async downloadFileAsync(url: string, destination: File, options: unknown) {
      mockDownloads.push({ url, dest: destination.uri, options });
      return destination;
    }
  }
  return { File, Paths: { cache: 'cache' } };
});

const mockLoadAsync = jest.fn();
jest.mock('expo-image', () => ({ Image: { loadAsync: (...a: unknown[]) => mockLoadAsync(...a) } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloads.length = 0;
  mockLoadAsync.mockResolvedValue({ width: 1200, height: 1600 });
});

/**
 * §5.4 — "Use this image" downloads into the **cache** dir under the UUID name,
 * **not** at Save. Landing in cache is what keeps the invariant (§4.3): by
 * Review a local file exists under our UUID for every source, and the document
 * dir still receives bytes only at Save — so an abandoned wizard leaves nothing
 * the OS won't reclaim.
 */
describe('downloadCandidate', () => {
  it('downloads into the cache dir under the UUID name', async () => {
    await downloadCandidate('https://cdn.acme.com/hero.jpg', 'a3f2c1de');

    expect(mockDownloads).toEqual([
      {
        url: 'https://cdn.acme.com/hero.jpg',
        dest: 'cache/a3f2c1de.jpg',
        options: expect.objectContaining({ idempotent: true }),
      },
    ]);
  });

  it('returns a CapturedImage carrying the UUID and the downloaded dimensions', async () => {
    mockLoadAsync.mockResolvedValue({ width: 1200, height: 1600 });

    const capture = await downloadCandidate('https://cdn.acme.com/hero.jpg', 'a3f2c1de');

    expect(capture).toEqual({
      uri: 'cache/a3f2c1de.jpg',
      width: 1200,
      height: 1600,
      uuid: 'a3f2c1de',
    });
    expect(mockLoadAsync).toHaveBeenCalledWith('cache/a3f2c1de.jpg');
  });
});
