/**
 * §5.7 — the persisted backing store behind a wizard's draft context.
 *
 * IndexedDB rather than `localStorage` for one reason: it stores **Blobs**
 * natively. A JSON-only draft would resume the cheap half of the walk and
 * re-restart the expensive one, making the user re-pick an image they had
 * already confirmed — which is ADR-0010's never-restart-a-flow read backwards.
 *
 * **One active record per flow**, keyed by the flow's name and overwritten as
 * the walk proceeds. Nothing accumulates, so nothing has to be swept.
 */

const DATABASE = 'wardrobe-tracker';
const STORE = 'drafts';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);

    request.onupgradeneeded = () => {
      // A plain key-value store: the key is the flow name, so a flow's record
      // replaces itself on every write and there is no second one to reconcile.
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<Result>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  return open().then(
    (database) =>
      new Promise<Result>((resolve, reject) => {
        const request = run(database.transaction(STORE, mode).objectStore(STORE));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        // The handle is per-call rather than module-level so a rejected open
        // leaves nothing half-initialized to reuse.
        request.transaction?.addEventListener('complete', () => database.close());
      }),
  );
}

/** The read/write/drop trio for one flow's draft record. */
export type DraftStore<Record> = {
  read: () => Promise<Record | null>;
  write: (record: Record) => Promise<void>;
  drop: () => Promise<void>;
};

export function draftStore<Record>(flow: string): DraftStore<Record> {
  return {
    read: async () => (await transact<Record | undefined>('readonly', (s) => s.get(flow))) ?? null,
    write: async (record) => {
      await transact('readwrite', (store) => store.put(record, flow));
    },
    drop: async () => {
      await transact('readwrite', (store) => store.delete(flow));
    },
  };
}
