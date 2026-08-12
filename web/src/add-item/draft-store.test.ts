import 'fake-indexeddb/auto';

import { draftStore } from './draft-store';

// A real IndexedDB implementation, not a mock of one: the whole claim under test
// is that a *Blob* survives a round trip, which a hand-rolled fake would grant
// for free.
const drafts = draftStore<{ blob: Blob; storageId: string | null }>('add-item');

beforeEach(async () => {
  await drafts.drop();
});

describe('a persisted draft', () => {
  it('round-trips the image blob, not only its JSON neighbours', async () => {
    await drafts.write({ blob: new Blob(['jpeg bytes'], { type: 'image/jpeg' }), storageId: null });

    const resumed = await drafts.read();

    expect(await resumed?.blob.text()).toBe('jpeg bytes');
    expect(resumed?.blob.type).toBe('image/jpeg');
  });

  it('keeps one active record per flow, overwritten as the walk proceeds', async () => {
    await drafts.write({ blob: new Blob(['first']), storageId: null });
    await drafts.write({ blob: new Blob(['second']), storageId: 'storage_1' });

    expect((await drafts.read())?.storageId).toBe('storage_1');
    expect(await (await drafts.read())?.blob.text()).toBe('second');
  });

  it('reads as absent once dropped', async () => {
    await drafts.write({ blob: new Blob(['jpeg']), storageId: null });
    await drafts.drop();

    expect(await drafts.read()).toBeNull();
  });

  it('keeps one flow out of another flow’s record', async () => {
    const builder = draftStore<{ name: string }>('outfit-builder');

    await drafts.write({ blob: new Blob(['jpeg']), storageId: null });
    await builder.write({ name: 'friday' });

    expect((await drafts.read())?.storageId).toBeNull();
    expect(await builder.read()).toEqual({ name: 'friday' });
  });
});
