import { decode, encode } from 'jpeg-js';

import { normalizeJpeg } from './normalizeImage';

/**
 * A real JPEG, built rather than fixtured: the subject is a codec, so bytes it
 * can actually decode are the only honest input, and a gradient keeps the
 * encoder from collapsing the image into one flat DC coefficient.
 */
function sourceJpeg(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    data[offset] = pixel % 256;
    data[offset + 1] = (pixel / width) % 256;
    data[offset + 2] = 128;
    data[offset + 3] = 255;
  }
  return new Uint8Array(encode({ width, height, data }, 90).data);
}

describe('normalizing a downloaded product image', () => {
  it('caps the long edge at 1200 and scales the other axis with it', () => {
    const normalized = normalizeJpeg(sourceJpeg(1500, 900));

    expect(normalized).toMatchObject({ width: 1200, height: 720 });
    const decoded = decode(normalized.bytes, { useTArray: true });
    expect([decoded.width, decoded.height]).toEqual([1200, 720]);
  });

  it('never upscales a source that is already inside the cap', () => {
    const normalized = normalizeJpeg(sourceJpeg(400, 300));

    expect(normalized).toMatchObject({ width: 400, height: 300 });
  });

  it('emits JPEG whatever it was handed', () => {
    const { bytes } = normalizeJpeg(sourceJpeg(400, 300));

    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  });

  it('encodes on a runtime with no Buffer, which is the one it has to run on', () => {
    // Built first: the helper encodes through the same library, and it has no
    // stand-in of its own to fall back on.
    const source = sourceJpeg(400, 300);
    vi.stubGlobal('Buffer', undefined);

    const { bytes } = normalizeJpeg(source);

    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
    vi.unstubAllGlobals();
  });

  it('rejects bytes that are not a decodable JPEG', () => {
    expect(() => normalizeJpeg(new TextEncoder().encode('<html>not an image</html>'))).toThrow();
  });
});
