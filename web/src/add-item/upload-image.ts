import type { Id } from '@convex/_generated/dataModel';

/**
 * §4.4 — the normalized blob's one trip to Convex storage, POSTed straight to a
 * short-lived signed URL rather than through a mutation argument: a mutation
 * carries JSON, and an image is not JSON.
 *
 * Split from the insert on purpose. The caller keeps the returned id in the
 * draft, so an insert that fails retries against the file already stored — the
 * flow is never restarted (ADR-0010), and a retry costs no second upload.
 */
export async function uploadImage(uploadUrl: string, blob: Blob): Promise<Id<'_storage'>> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });

  if (!response.ok) {
    throw new Error("Couldn't upload that image");
  }

  const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
  return storageId;
}
