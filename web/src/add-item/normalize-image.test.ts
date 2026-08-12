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
 * jsdom has neither `createImageBitmap` nor a canvas 2D context, so both are
 * stubbed: the decode records the options it was called with, which is the only
 * way to observe that the resize happens *during* decode rather than after.
 */
type BitmapCall = { source: unknown; options?: ImageBitmapOptions };

function stubImagePipeline(source: { width: number; height: number }) {
  const calls: BitmapCall[] = [];
  const encoded: { type?: string; quality?: number } = {};

  vi.stubGlobal('createImageBitmap', (from: unknown, options?: ImageBitmapOptions) => {
    calls.push({ source: from, options });
    return Promise.resolve({
      width: options?.resizeWidth ?? source.width,
      height: options?.resizeHeight ?? source.height,
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

  it('resizes during decode, so the canvas is only ever the target size', async () => {
    const { calls } = stubImagePipeline({ width: 4000, height: 3000 });

    const image = await normalizeImage(new Blob([]));

    expect(calls[1].options).toMatchObject({ resizeWidth: 1200, resizeHeight: 900 });
    expect(image).toMatchObject({ width: 1200, height: 900 });
  });

  it('decodes a within-bounds source once and leaves its size alone', async () => {
    const { calls } = stubImagePipeline({ width: 400, height: 300 });

    const image = await normalizeImage(new Blob([]));

    expect(calls).toHaveLength(1);
    expect(image).toMatchObject({ width: 400, height: 300 });
  });
});
