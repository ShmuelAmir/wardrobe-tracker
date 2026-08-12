import { Blob as PlatformBlob } from 'node:buffer';
import { join } from 'node:path';

/**
 * The one thing the byte-identical domain ports need that an ESM runner does not
 * give them: `__dirname`. Three of them (`no-raw-hex`, `domain-db-free`,
 * `web-import-gallery`) resolve a path relative to their own file, which is free
 * in Jest's CJS module scope and undefined under Vitest.
 *
 * A single global value is correct here rather than approximate, because every
 * ported test lives in the same directory — `__tests__/`. A test that moves out
 * of it stops being one of these ports, and the port list in `vitest.config.ts`
 * is where that shows up.
 *
 * The repo root arrives through `test.env` rather than `import.meta.url`, which
 * Vitest's transform does not leave as a `file:` URL.
 */
(globalThis as { __dirname?: string }).__dirname = join(
  process.env.WARDROBE_REPO_ROOT as string,
  '__tests__',
);

/**
 * jsdom's `Blob` is opaque to `structuredClone` — it clones to a bare `{}`,
 * losing the bytes — and structured cloning is exactly how IndexedDB stores a
 * value. The platform `Blob` clones properly, so swapping it in is what lets a
 * §5.7 draft test assert the thing browsers actually guarantee: a Blob written
 * to IndexedDB reads back as a Blob.
 */
globalThis.Blob = PlatformBlob as unknown as typeof globalThis.Blob;

/**
 * jsdom implements neither half of the object-URL pair, which the wizard uses to
 * preview a picked image without uploading it (§4.4). The stub only has to mint
 * a unique string and forget it — no test reads bytes back out of one.
 */
let objectUrls = 0;
URL.createObjectURL = () => `blob:wardrobe/${(objectUrls += 1)}`;
URL.revokeObjectURL = () => {};
