import { getAuthUserId } from '@convex-dev/auth/server';

import type { MutationCtx, QueryCtx } from './_generated/server';

/**
 * The only way a function learns who is asking (§13.2, invariant #1). **No
 * query, mutation or action takes a `userId` argument**, every read is scoped
 * `by_user`, and there is no hardcoded-owner pin — which is what keeps
 * multi-user later a schema-and-signup job rather than a rewrite.
 *
 * > ⚠️ It wraps `getAuthUserId`, **never `getUserIdentity().subject`**. Under
 * > Convex Auth that subject is `userId|sessionId`, so a `.subject`-keyed write
 * > is scoped to the *session*: the laptop and the phone would each write under
 * > a different id and neither would see the other's wardrobe — silently, with
 * > no error. `convex/authz.test.ts` drives two sessions of one identity for
 * > exactly this reason.
 */
export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error('Not signed in');
  }

  return userId;
}
