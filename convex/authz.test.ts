import { convexTest } from 'convex-test';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

/**
 * The first of §15.5's two mandated tests (invariant #1). It drives **two
 * identities**, because one cannot catch what it guards: under Convex Auth
 * `getUserIdentity().subject` is `userId|sessionId`, so a `.subject`-keyed read
 * still returns the caller's own rows to the session that wrote them, and the
 * damage — the laptop and the phone each writing under a different id — only
 * appears once a second session exists.
 *
 * `subject` is spelled here the way Convex Auth spells it, since that shape is
 * the whole subject of the test.
 */
const identity = (userId: string, sessionId: string) => ({ subject: `${userId}|${sessionId}` });

/**
 * The function modules, listed explicitly because the runner's root is `web/`
 * and convex-test's default glob resolves from there.
 */
const modules = import.meta.glob('./**/*.ts');

const wardrobe = () => convexTest(schema, modules);

const LAPTOP = identity('owner', 'session_laptop');
const PHONE = identity('owner', 'session_phone');
const SOMEONE_ELSE = identity('stranger', 'session_stranger');

/** Rows are seeded straight into the tables: the write paths are later tickets. */
async function seedItem(t: ReturnType<typeof convexTest>, userId: string, name: string) {
  return await t.run(async (ctx) => {
    const image = await ctx.storage.store(new Blob([name]));

    return await ctx.db.insert('items', {
      userId,
      image,
      imageUrl: `https://example.test/${name}.jpg`,
      category: 'Top',
      name,
    });
  });
}

describe('every read is scoped to the owner resolved from the auth token', () => {
  it('shows one owner both sessions of their own wardrobe, not one each', async () => {
    const t = wardrobe();
    await seedItem(t, 'owner', 'linen shirt');

    const onLaptop = await t.withIdentity(LAPTOP).query(api.items.list, {});
    const onPhone = await t.withIdentity(PHONE).query(api.items.list, {});

    expect(onLaptop.map((item) => item.name)).toEqual(['linen shirt']);
    expect(onPhone.map((item) => item.name)).toEqual(['linen shirt']);
  });

  it('hides another identity’s items entirely', async () => {
    const t = wardrobe();
    await seedItem(t, 'owner', 'linen shirt');
    await seedItem(t, 'stranger', 'wool coat');

    const mine = await t.withIdentity(LAPTOP).query(api.items.list, {});
    const theirs = await t.withIdentity(SOMEONE_ELSE).query(api.items.list, {});

    expect(mine.map((item) => item.name)).toEqual(['linen shirt']);
    expect(theirs.map((item) => item.name)).toEqual(['wool coat']);
  });

  it('refuses a caller with no identity at all', async () => {
    const t = wardrobe();
    await seedItem(t, 'owner', 'linen shirt');

    await expect(t.query(api.items.list, {})).rejects.toThrow('Not signed in');
  });
});

describe('the schema rejects values outside the closed vocabularies', () => {
  it('refuses a category that is not one of the six', async () => {
    const t = wardrobe();

    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('items', {
          userId: 'owner',
          image: 'nonexistent' as Id<'_storage'>,
          imageUrl: 'https://example.test/hat.jpg',
          category: 'Hat' as 'Top',
        });
      }),
    ).rejects.toThrow();
  });

  it('refuses a season that is not one of the four', async () => {
    const t = wardrobe();

    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('items', {
          userId: 'owner',
          image: 'nonexistent' as Id<'_storage'>,
          imageUrl: 'https://example.test/scarf.jpg',
          category: 'Accessory',
          season: ['monsoon' as 'winter'],
        });
      }),
    ).rejects.toThrow();
  });
});
