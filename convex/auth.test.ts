import { convexTest } from 'convex-test';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

import { api } from './_generated/api';
import schema from './schema';

/**
 * §13.4 — `signUp` stays on the server permanently so the account can be
 * recreated, and is dead by construction: it needs the secret **and** an empty
 * `users` table, so neither gate alone opens it.
 */

const modules = import.meta.glob('./**/*.ts');

const SECRET = 'the-operator-knows-this';
const CREDENTIALS = { email: 'owner@example.test', password: 'a-long-enough-password' };

const signUp = (t: ReturnType<typeof convexTest>, params: Record<string, unknown>) =>
  t.action(api.auth.signIn, { provider: 'password', params: { flow: 'signUp', ...params } });

/**
 * A signing key per run, standing in for the pair `npx @convex-dev/auth` sets on
 * a real deployment. Without it a *successful* sign-in dies at token generation,
 * which would leave the gate below looking closed for the wrong reason.
 */
let signingKeys: Record<string, string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });

  signingKeys = {
    JWT_PRIVATE_KEY: await exportPKCS8(privateKey),
    JWKS: JSON.stringify({ keys: [await exportJWK(publicKey)] }),
    // The token's issuer. On a deployment Convex sets it; §14.1's permanent
    // origin is the real value, and any well-formed URL serves here.
    CONVEX_SITE_URL: 'https://wardrobe.test',
    // The library logs every `auth:store` round trip at INFO by default, which
    // buries the assertions under a dozen lines per test.
    AUTH_LOG_LEVEL: 'ERROR',
  };
});

// The gate reads the deployment variable at call time, so each test states the
// deployment it is describing rather than relying on the ambient environment.
beforeEach(() => {
  for (const [name, value] of Object.entries(signingKeys)) {
    vi.stubEnv(name, value);
  }

  vi.stubEnv('OWNER_SIGNUP_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sign-up', () => {
  it('creates the owner when the secret matches and no user exists', async () => {
    const t = convexTest(schema, modules);

    await signUp(t, { ...CREDENTIALS, secret: SECRET });

    const users = await t.run((ctx) => ctx.db.query('users').collect());
    expect(users.map((user) => user.email)).toEqual([CREDENTIALS.email]);
  });

  it('refuses a wrong secret', async () => {
    const t = convexTest(schema, modules);

    await expect(signUp(t, { ...CREDENTIALS, secret: 'guessed' })).rejects.toThrow();

    const users = await t.run((ctx) => ctx.db.query('users').collect());
    expect(users).toEqual([]);
  });

  it('refuses a missing secret', async () => {
    const t = convexTest(schema, modules);

    await expect(signUp(t, CREDENTIALS)).rejects.toThrow();
  });

  it('refuses even the right secret once the owner exists', async () => {
    const t = convexTest(schema, modules);
    await signUp(t, { ...CREDENTIALS, secret: SECRET });

    await expect(
      signUp(t, { email: 'second@example.test', password: 'a-long-enough-password', secret: SECRET }),
    ).rejects.toThrow();

    const users = await t.run((ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
  });

  it('refuses everything when the deployment has no secret set', async () => {
    vi.stubEnv('OWNER_SIGNUP_SECRET', '');
    const t = convexTest(schema, modules);

    await expect(signUp(t, { ...CREDENTIALS, secret: '' })).rejects.toThrow();
  });
});

describe('sign-in', () => {
  it('lets the owner back in with their password', async () => {
    const t = convexTest(schema, modules);
    await signUp(t, { ...CREDENTIALS, secret: SECRET });

    const result = await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', ...CREDENTIALS },
    });

    expect(result.tokens).not.toBeNull();
  });

  it('refuses the wrong password', async () => {
    const t = convexTest(schema, modules);
    await signUp(t, { ...CREDENTIALS, secret: SECRET });

    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'signIn', email: CREDENTIALS.email, password: 'not-the-password' },
      }),
    ).rejects.toThrow();
  });
});
