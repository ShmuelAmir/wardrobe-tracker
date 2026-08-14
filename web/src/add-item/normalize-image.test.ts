import { normalizeImage, resizePlan } from './normalize-image';

describe('the resize plan', () => {
  it('caps the long edge at 1200 and scales the other axis with it', () => {
    expect(resizePlan(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(resizePlan(3000, 4000)).toEqual({ width: 900, height: 1200 });
  });

  it('never upscales a source that is already smaller', () => {
    expect(resizePlan(400, 300)).toEqual({ width: 400, height: 300 });
    expect(resizePlan(1200, 1200)).toEqual({ width: 1200, height: 1200 });
  });
});

/**
 * jsdom has neither `createImageBitmap`, an `<img>` that loads, nor a canvas 2D
 * context, so all three are stubbed. The decode records the options it was
 * called with, which is the only way to observe that the resize happens *during*
 * decode rather than after.
 */
type BitmapCall = { source: unknown; options?: ImageBitmapOptions };

function stubImagePipeline(source: { width: number; height: number }) {
  const calls: BitmapCall[] = [];
  const encoded: { type?: string; quality?: number } = {};

  // The intrinsic size an `<img>` would report, which is how the long edge is
  // picked without decoding anything.
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => source.width,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
    configurable: true,
    get: () => source.height,
  });
  vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (
    this: HTMLImageElement,
  ) {
    this.onload?.(new Event('load'));
  });

  vi.stubGlobal('createImageBitmap', (from: unknown, options?: ImageBitmapOptions) => {
    calls.push({ source: from, options });
    const scale = options?.resizeWidth
      ? options.resizeWidth / source.width
      : options?.resizeHeight
        ? options.resizeHeight / source.height
        : 1;

    return Promise.resolve({
      width: Math.round(source.width * scale),
      height: Math.round(source.height * scale),
      close: () => {},
    });
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
    quality,
  ) {
    encoded.type = type;
    encoded.quality = quality as number;
    callback(new Blob(['bytes'], { type }));
  });

  return { calls, encoded };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizing a picked file', () => {
  it('encodes JPEG at q0.8 whatever the source format', async () => {
    const { encoded } = stubImagePipeline({ width: 4000, height: 3000 });

    const image = await normalizeImage(new Blob([], { type: 'image/png' }));

    expect(encoded).toEqual({ type: 'image/jpeg', quality: 0.8 });
    expect(image.blob.type).toBe('image/jpeg');
  });

  it('resizes during the one decode, so no full-size bitmap is ever built', async () => {
    const { calls } = stubImagePipeline({ width: 4000, height: 3000 });
    const file = new Blob([]);

    const image = await normalizeImage(file);

    // The resize options reach the decode of the *file* — a second decode, or a
    // first one without them, is the full-size bitmap iOS chokes on.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ source: file, options: { resizeWidth: 1200 } });
    expect(image).toMatchObject({ width: 1200, height: 900 });
  });

  it('caps whichever edge is the long one, and names only that one', async () => {
    const { calls } = stubImagePipeline({ width: 3000, height: 4000 });

    const image = await normalizeImage(new Blob([]));

    // Naming one axis leaves the ratio to the decoder, so nothing can stretch.
    expect(calls[0].options).toMatchObject({ resizeHeight: 1200 });
    expect(calls[0].options).not.toHaveProperty('resizeWidth');
    expect(image).toMatchObject({ width: 900, height: 1200 });
  });

  it('still caps a sliver, whose short edge survives the scale unrounded', async () => {
    const { calls } = stubImagePipeline({ width: 1, height: 2000 });

    const image = await normalizeImage(new Blob([]));

    // A 1px short edge scales to 0.6 and rounds back to 1, so a plan that
    // reads "unchanged" off that axis alone would call this source in-bounds
    // and store it at its full 2000px height.
    expect(calls[0].options).toMatchObject({ resizeHeight: 1200 });
    expect(image.height).toBe(1200);
  });

  it('asks for no resize at all when the source is already within bounds', async () => {
    const { calls } = stubImagePipeline({ width: 400, height: 300 });

    const image = await normalizeImage(new Blob([]));

    expect(calls[0].options).not.toHaveProperty('resizeWidth');
    expect(calls[0].options).not.toHaveProperty('resizeHeight');
    expect(image).toMatchObject({ width: 400, height: 300 });
  });
});
