import * as Y from "yjs";
import { encodeStateAsUpdate, applyUpdateToDoc } from "@collab-planner/yjs-utils";
import { documentRegistry } from "./yjs-document-registry.js";
import { YjsPersistenceRepository } from "./yjs-persistence.repository.js";
import { pubClient } from "./server.js";

/**
 * Perform snapshot compaction for a specific docId.
 * Uses Redis distributed locks to avoid multi-node database writes contention.
 */
export async function compactDocument(docId: string): Promise<boolean> {
  if (!pubClient) {
    console.warn("Redis client is not initialized. Skipping compaction for:", docId);
    return false;
  }

  const lockKey = `lock:compaction:${docId}`;
  const lockToken = Math.random().toString(36).substring(2, 15);
  const lockTimeout = 30000; // 30 seconds

  // 1. Attempt to acquire distributed lock
  // NX: Only set if not exists, PX: Expire after PX milliseconds
  const lockAcquired = await (pubClient as any).set(lockKey, lockToken, "NX", "PX", lockTimeout);
  if (lockAcquired !== "OK") {
    // Lock held by another instance
    return false;
  }

  try {
    console.log(`[Compaction] Lock acquired for document ${docId}. Starting compaction...`);

    // 2. Fetch baseline snapshot
    const snapshot = await YjsPersistenceRepository.getSnapshot(docId);
    const tempDoc = new Y.Doc();
    let version = 1;
    let since: Date | undefined;

    if (snapshot) {
      applyUpdateToDoc(tempDoc, snapshot.state, "compaction-hydrate");
      version = snapshot.version + 1;
      since = snapshot.updatedAt;
    }

    // 3. Fetch incremental updates since the snapshot
    const deltas = await YjsPersistenceRepository.getUpdates(docId, since);
    if (deltas.length === 0) {
      console.log(`[Compaction] No new updates to compact for ${docId}`);
      await releaseLock(lockKey, lockToken);
      return true;
    }

    // 4. Capture the timestamp of the latest log to be compacted
    const maxTimestamp = deltas[deltas.length - 1].createdAt;

    // 5. Apply updates to the temporary document representation
    for (const delta of deltas) {
      applyUpdateToDoc(tempDoc, delta.update, "compaction-merge");
    }

    // 6. Encode consolidated Y.Doc state
    const compactedState = encodeStateAsUpdate(tempDoc);

    // 7. Save consolidated snapshot to MongoDB
    await YjsPersistenceRepository.saveSnapshot(docId, compactedState, version);
    console.log(`[Compaction] Consolidated snapshot saved for ${docId} (Version: ${version})`);

    // 8. Delete compacted log records using a strict timestamp boundary
    const deletedCount = await YjsPersistenceRepository.deleteUpdates(docId, maxTimestamp);
    console.log(`[Compaction] Purged ${deletedCount} compacted log entries for ${docId}`);

    return true;
  } catch (err) {
    console.error(`[Compaction] Error during compaction for document ${docId}:`, err);
    return false;
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

/**
 * Release Redis lock safely
 */
async function releaseLock(lockKey: string, lockToken: string): Promise<void> {
  if (!pubClient) return;
  try {
    const currentValue = await pubClient.get(lockKey);
    if (currentValue === lockToken) {
      await pubClient.del(lockKey);
      console.log(`[Compaction] Lock released for key: ${lockKey}`);
    }
  } catch (err) {
    console.error(`[Compaction] Failed to release Redis lock:`, err);
  }
}

/**
 * Starts a periodic interval scheduler to run compaction for active documents
 */
export function startCompactionScheduler(intervalMs: number = 300000): NodeJS.Timeout {
  console.log(`⏱️ Starting Compaction Scheduler (Interval: ${intervalMs / 1000}s)`);

  return setInterval(async () => {
    const activeDocIds = documentRegistry.keys();
    if (activeDocIds.length === 0) return;

    console.log(`[Compaction Scheduler] Running checks for ${activeDocIds.length} active documents...`);

    for (const docId of activeDocIds) {
      await compactDocument(docId);
    }
  }, intervalMs);
}
