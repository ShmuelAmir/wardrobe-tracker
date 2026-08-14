import { convexTest } from 'convex-test';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const wardrobe = () => convexTest(schema, modules);

const OWNER = { subject: 'owner|session_laptop' };

/** A stored file to point a row at, standing in for the wizard's upload. */
async function storeImage(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(['jpeg'])));
}

describe('creating an item', () => {
  it('stores both the storage id and the resolved serving URL', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await t.withIdentity(OWNER).mutation(api.items.create, { image, category: 'Top' });

    const [item] = await t.withIdentity(OWNER).query(api.items.list, {});
    const url = await t.run(async (ctx) => await ctx.storage.getUrl(image));

    expect(item.image).toBe(image);
    expect(item.imageUrl).toBe(url);
    // §4.3 in one assertion: the URL is an unrelated opaque token, so a row that
    // kept only the id would owe a `_storage` read per item per reactive re-run.
    expect(item.imageUrl).not.toContain(image);
  });

  it('keeps category required and the other three fields optional', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await t.withIdentity(OWNER).mutation(api.items.create, {
      image,
      category: 'Outerwear',
      name: 'wool coat',
      brand: 'Uniqlo',
      season: ['fall', 'winter'],
    });

    const [item] = await t.withIdentity(OWNER).query(api.items.list, {});

    expect(item).toMatchObject({
      category: 'Outerwear',
      name: 'wool coat',
      brand: 'Uniqlo',
      season: ['fall', 'winter'],
    });
  });

  it('records the source URL a web import carries, and leaves it absent otherwise', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await t.withIdentity(OWNER).mutation(api.items.create, {
      image,
      category: 'Top',
      sourceUrl: 'https://acme.test/p/coat',
    });
    await t.withIdentity(OWNER).mutation(api.items.create, { image, category: 'Bag' });

    const [bag, top] = await t.withIdentity(OWNER).query(api.items.list, {});

    expect(top.sourceUrl).toBe('https://acme.test/p/coat');
    expect(bag.sourceUrl).toBeUndefined();
  });

  it('accepts the optional fields spelled as explicit undefined, which is what the form sends', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await t.withIdentity(OWNER).mutation(api.items.create, {
      image,
      category: 'Top',
      name: undefined,
      brand: undefined,
      season: undefined,
      sourceUrl: undefined,
    });

    const [item] = await t.withIdentity(OWNER).query(api.items.list, {});
    expect(item.name).toBeUndefined();
  });

  it('scopes the row to the caller resolved from the token, not to an argument', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await t.withIdentity(OWNER).mutation(api.items.create, { image, category: 'Bag' });

    const [item] = await t.withIdentity(OWNER).query(api.items.list, {});

    expect(item.userId).toBe('owner');
    expect(await t.withIdentity({ subject: 'stranger|s' }).query(api.items.list, {})).toEqual([]);
  });

  it('refuses a caller with no identity', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await expect(t.mutation(api.items.create, { image, category: 'Top' })).rejects.toThrow(
      'Not signed in',
    );
  });

  it('refuses a category outside the six', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await expect(
      t.withIdentity(OWNER).mutation(api.items.create, { image, category: 'Hat' as 'Top' }),
    ).rejects.toThrow();
  });

  it('writes no row for a storage id that names no file', async () => {
    const t = wardrobe();

    await expect(
      t
        .withIdentity(OWNER)
        .mutation(api.items.create, { image: 'gone' as Id<'_storage'>, category: 'Top' }),
    ).rejects.toThrow();

    expect(await t.withIdentity(OWNER).query(api.items.list, {})).toEqual([]);
  });

  it('lets a retry reuse the storage id a failed attempt already uploaded', async () => {
    const t = wardrobe();
    const image = await storeImage(t);

    await expect(
      t.withIdentity(OWNER).mutation(api.items.create, { image, category: 'Hat' as 'Top' }),
    ).rejects.toThrow();
    await t.withIdentity(OWNER).mutation(api.items.create, { image, category: 'Top' });

    const items = await t.withIdentity(OWNER).query(api.items.list, {});

    expect(items.map((item) => item.image)).toEqual([image]);
  });
});

describe('the upload URL', () => {
  it('is minted only for a signed-in caller', async () => {
    const t = wardrobe();

    expect(await t.withIdentity(OWNER).mutation(api.items.generateUploadUrl, {})).toContain(
      'upload',
    );
    await expect(t.mutation(api.items.generateUploadUrl, {})).rejects.toThrow('Not signed in');
  });
});
