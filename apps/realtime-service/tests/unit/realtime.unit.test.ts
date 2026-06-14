import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { YjsPersistenceRepository } from "../../src/yjs-persistence.repository.js";
import { compactDocument } from "../../src/yjs-compaction.worker.js";
import { encodeStateAsUpdate } from "@collab-planner/yjs-utils";

// Mock database storage
const mockDb = new Map<string, any>();
const mockLogs = new Map<string, any[]>();

// Mock database models and redis client
vi.mock("../../src/yjs-persistence.repository.js", () => {
  return {
    YjsPersistenceRepository: {
      getSnapshot: vi.fn(async (docId: string) => mockDb.get(docId) || null),
      saveSnapshot: vi.fn(async (docId: string, state: Buffer, version: number) => {
        mockDb.set(docId, { state, version, updatedAt: new Date() });
      }),
      appendUpdate: vi.fn(async (docId: string, update: Buffer) => {
        const list = mockLogs.get(docId) || [];
        list.push({ docId, update, createdAt: new Date() });
        mockLogs.set(docId, list);
      }),
      getUpdates: vi.fn(async (docId: string, since?: Date) => {
        const list = mockLogs.get(docId) || [];
        if (since) {
          return list.filter(l => l.createdAt > since);
        }
        return list;
      }),
      deleteUpdates: vi.fn(async (docId: string, beforeOrAt: Date) => {
        const list = mockLogs.get(docId) || [];
        const keep = list.filter(l => l.createdAt > beforeOrAt);
        const deleted = list.length - keep.length;
        mockLogs.set(docId, keep);
        return deleted;
      })
    }
  };
});

vi.mock("../../src/server.js", () => {
  return {
    pubClient: {
      set: vi.fn(async () => "OK"),
      get: vi.fn(async () => "token"),
      del: vi.fn(async () => 1)
    }
  };
});

describe("Yjs Sync & Compaction Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully save and retrieve snapshots via the mock repository", async () => {
    const docId = "plan:test-1";
    const testDoc = new Y.Doc();
    testDoc.getMap("items").set("task-1", { title: "Test task" });
    const state = encodeStateAsUpdate(testDoc);

    await YjsPersistenceRepository.saveSnapshot(docId, state, 1);
    const snap = await YjsPersistenceRepository.getSnapshot(docId);
    expect(snap).toBeDefined();
    expect(snap?.version).toBe(1);
    expect(snap?.state).toEqual(state);
  });

  it("should successfully run compaction log consolidation", async () => {
    const docId = "plan:test-2";
    
    // Add incremental edits
    const testDoc = new Y.Doc();
    testDoc.getMap("items").set("task-1", { title: "Edit 1" });
    const update1 = encodeStateAsUpdate(testDoc);
    await YjsPersistenceRepository.appendUpdate(docId, update1);

    testDoc.getMap("items").set("task-2", { title: "Edit 2" });
    const update2 = encodeStateAsUpdate(testDoc);
    await YjsPersistenceRepository.appendUpdate(docId, update2);

    // Assert updates are in logs before compaction
    const logs = await YjsPersistenceRepository.getUpdates(docId);
    expect(logs.length).toBe(2);

    // Run compaction
    const compactionResult = await compactDocument(docId);
    expect(compactionResult).toBe(true);

    // Assert logs are deleted and compacted to snapshot
    const snap = await YjsPersistenceRepository.getSnapshot(docId);
    expect(snap).toBeDefined();
    expect(snap?.version).toBe(1);

    const logsAfter = await YjsPersistenceRepository.getUpdates(docId);
    expect(logsAfter.length).toBe(0);
  });
});
