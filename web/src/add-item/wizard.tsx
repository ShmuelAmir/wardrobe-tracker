import { Outlet, useLocation, useNavigate } from 'react-router';

import { AddItemDraftProvider, useAddItemDraft } from './add-item-draft';
import './add-item.css';

/**
 * The add-item wizard (§5): one decision per full screen, always-forward, and
 * **every step a real route** — which is what makes browser Back wizard Back
 * without the wizard implementing history itself.
 *
 * The draft provider spans every step, so the picked image survives both the
 * walk and a reload (§5.7).
 */
export function AddItemWizard() {
  return (
    <section className="wizard" data-surface="add-item-wizard">
      <AddItemDraftProvider>
        <WizardChrome />
        <Outlet />
      </AddItemDraftProvider>
    </section>
  );
}

/**
 * §7.8 — the surface's own exits, so Back is an *alias* for one rather than the
 * only way out. Back is absent on the first step, which has nothing to step back
 * to, and on the terminal step, which owns its own two exits.
 */
function WizardChrome() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { clear } = useAddItemDraft();

  // The first step has nothing to step back to, and the terminal step owns its
  // own two exits — so each end of the walk drops one affordance.
  const first = pathname === '/add';
  const terminal = pathname === '/add/saved';

  function cancel() {
    // Explicit Cancel is one of the two acts that drop the record (§5.7); a walk
    // simply abandoned keeps it, and resumes on the next visit.
    clear();
    navigate('/');
  }

  return (
    <header className="wizard__chrome">
      {!first && !terminal && (
        <button className="wizard__back" type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      )}
      {!terminal && (
        <button className="wizard__cancel" type="button" onClick={cancel}>
          Cancel
        </button>
      )}
    </header>
  );
}
