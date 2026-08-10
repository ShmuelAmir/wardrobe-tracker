/**
 * The deployment issues and validates its own JWTs (§13.1) — there is no hosted
 * provider to trust, which is the whole point of password mode. `CONVEX_SITE_URL`
 * is set by Convex itself, so this file needs no configured secret.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
