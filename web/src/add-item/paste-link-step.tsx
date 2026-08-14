import { isFetchableUrl, OFFLINE_MESSAGE } from '@/web-import';
import { api } from '@convex/_generated/api';
import { useAction, useConvexConnectionState } from 'convex/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAddItemDraft } from './add-item-draft';

/**
 * Step 2 — paste a link (§5.1), and the two failure states behind it (§5.4).
 * Fetch lights up on `http(s)` **syntax alone**: never a judgement about whether
 * this is a product page, because any rule sharp enough to reject a homepage
 * eventually rejects a real one. The confirm-image step is the validation.
 *
 * The outcome splits on the user's **next action**, not on the diagnosis they
 * cannot act on:
 *
 *  - **retryable** — the page is unreachable *right now*, so the field stays as
 *    it is and the button becomes Retry.
 *  - **dead-end** — retrying cannot help, so there is no Retry at all
 *    (invariant #8). The parse is seeded into the draft and the walk continues
 *    to Review, which holds everything but the image (§5.5).
 */
type Phase = { kind: 'idle' } | { kind: 'fetching' } | { kind: 'retryable'; message: string };

export function PasteLinkStep() {
  const navigate = useNavigate();
  const { clearImage, setImported } = useAddItemDraft();
  const importPage = useAction(api.webImport.importPage);
  // §14.5 — the socket, never `navigator.onLine`, which lies through captive
  // portals. The wizard renders behind `<Authenticated>`, so a socket that is
  // down here has genuinely dropped rather than not yet opened.
  const { isWebSocketConnected } = useConvexConnectionState();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const fetching = phase.kind === 'fetching';

  async function fetchPage() {
    if (!isFetchableUrl(url) || fetching) return;

    // The pre-flight spends no round trip on a request that cannot leave, and
    // lands on the same retryable state a timeout would.
    if (!isWebSocketConnected) {
      setPhase({ kind: 'retryable', message: OFFLINE_MESSAGE });
      return;
    }

    setPhase({ kind: 'fetching' });
    let outcome;
    try {
      outcome = await importPage({ url });
    } catch {
      // The action itself returns structured failures (invariant #7), so a throw
      // here is Convex being unreachable — which is the same shrug as the site
      // being unreachable, and the same Retry.
      setPhase({ kind: 'retryable', message: OFFLINE_MESSAGE });
      return;
    }

    if (outcome.status === 'retryable') {
      setPhase({ kind: 'retryable', message: outcome.message });
      return;
    }

    if (outcome.status === 'dead-end') {
      // Nothing is thrown away except an image belonging to a *different* page:
      // Back makes a second paste reachable with the first page's image still in
      // the draft, and Review would otherwise offer it under this page's URL.
      clearImage();
      // `sourceUrl` always, name and brand whenever the parse returned them.
      setImported({
        sourceUrl: outcome.sourceUrl,
        name: outcome.name,
        brand: outcome.brand,
        candidates: [],
        message: outcome.message,
      });
      navigate('/add/review');
      return;
    }

    setImported({ ...outcome.result, message: null });
    navigate('/add/confirm-image');
  }

  return (
    <div className="wizard__body" data-surface="add-paste-link">
      <h1 className="wizard__title">Paste a link</h1>

      <label className="wizard__field">
        <span className="review__label">Product page URL</span>
        <input
          autoFocus
          className="review__input"
          disabled={fetching}
          inputMode="url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          value={url}
        />
      </label>

      {phase.kind === 'retryable' && (
        <p className="wizard__error" role="alert">
          {phase.message}
        </p>
      )}

      <button
        className="wizard__cta"
        type="button"
        disabled={!isFetchableUrl(url) || fetching}
        onClick={fetchPage}
      >
        {fetching ? 'Fetching…' : phase.kind === 'retryable' ? 'Retry' : 'Fetch'}
      </button>
    </div>
  );
}
