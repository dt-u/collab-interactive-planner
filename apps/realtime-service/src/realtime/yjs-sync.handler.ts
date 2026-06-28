import { Socket } from "socket.io";
import * as Y from "yjs";
import { SocketEvents } from "@collab-planner/realtime-protocol";
import {
  encodeStateVector,
  encodeStateAsUpdateWithVector,
  applyUpdateToDoc,
} from "@collab-planner/yjs-utils";
import { documentRegistry } from "../yjs-document-registry.js";
import { YjsPersistenceRepository } from "../yjs-persistence.repository.js";
import { RealtimeServer, pubClient, io } from "../server.js";
import { PlanModel } from "../models/plan.model.js";

// Tracks concurrent database hydrations to avoid duplicate queries
const pendingHydrations = new Map<string, Promise<void>>();

// Unique ID for this cluster server instance
export const serverInstanceId = Math.random().toString(36).substring(2, 15);

/**
 * Hydrates a Y.Doc from its MongoDB snapshot and incremental log updates
 */
export async function hydrateDocument(docId: string, doc: Y.Doc): Promise<void> {
  const snapshot = await YjsPersistenceRepository.getSnapshot(docId);
  if (snapshot) {
    applyUpdateToDoc(doc, snapshot.state, "db-snapshot");
  }

  // Load incremental updates since the snapshot
  const since = snapshot ? snapshot.updatedAt : undefined;
  const deltas = await YjsPersistenceRepository.getUpdates(docId, since);

  for (const delta of deltas) {
    applyUpdateToDoc(doc, delta.update, "db-delta");
  }

  // If the document has no snapshot and no deltas, it is completely new.
  // Initialize with exactly 3 default days and 1 default task card as requested by the user.
  if (!snapshot && deltas.length === 0) {
    console.log(`Initializing default workspace days and item for new Y.Doc: ${docId}`);
    
    // Fetch plan details from database to initialize boardInfo name
    let planName = "My Plan Board";
    try {
      const plan = await PlanModel.findById(docId);
      if (plan) {
        planName = plan.name;
      }
    } catch (dbErr) {
      console.error(`Failed to fetch plan details for initial YDoc hydration:`, dbErr);
    }

    doc.transact(() => {
      const boardInfoMap = doc.getMap("boardInfo");
      boardInfoMap.set("name", planName);
      boardInfoMap.set("location", "VIETNAM");

      const orderArray = doc.getArray("columnOrder");
      const metadataMap = doc.getMap("columnMetadata");
      const columnsMap = doc.getMap("columns");
      const itemsMap = doc.getMap("items");

      orderArray.push(["day_1", "day_2", "day_3"]);

      metadataMap.set("day_1", { id: "day_1", title: "DAY 1: EXPLORE" });
      metadataMap.set("day_2", { id: "day_2", title: "DAY 2: RELAX & EAT" });
      metadataMap.set("day_3", { id: "day_3", title: "DAY 3: NATURE" });

      columnsMap.set("day_1", new Y.Array<string>());
      columnsMap.set("day_2", new Y.Array<string>());
      columnsMap.set("day_3", new Y.Array<string>());

      // Add exactly 1 default activity item as requested
      const defaultTaskId = "task_init_" + Math.random().toString(36).substring(2, 6);
      const taskMap = new Y.Map();
      taskMap.set("id", defaultTaskId);
      taskMap.set("title", "Plan Dalat Itinerary!");
      taskMap.set("description", "Start planning activities for Day 1.");
      taskMap.set("status", "day_1");
      taskMap.set("time", "09:00 AM");
      taskMap.set("cost", "Free");
      taskMap.set("image", "");

      itemsMap.set(defaultTaskId, taskMap);

      const day1Array = columnsMap.get("day_1") as Y.Array<string>;
      day1Array.push([defaultTaskId]);
    });

    // Save this initial state to MongoDB
    const stateUpdate = Y.encodeStateAsUpdate(doc);
    await YjsPersistenceRepository.appendUpdate(docId, Buffer.from(stateUpdate));
  }

  console.log(`Hydrated Y.Doc ${docId}: Snapshot version ${snapshot?.version || 0}, applied ${deltas.length} delta updates.`);
}

/**
 * Helper to get or load/hydrate Y.Doc in-memory
 */
export async function getOrLoadDocument(docId: string): Promise<Y.Doc> {
  const doc = documentRegistry.getOrCreate(docId);

  // If the document has already been loaded, return it
  if (doc.store.clients.size > 0 || documentRegistry.has(docId) && !pendingHydrations.has(docId)) {
    // If it's already in memory and populated, return immediately
    // Note: Y.Doc stores clients size > 0 if updates are applied
    if (doc.store.clients.size > 0) {
      return doc;
    }
  }

  let promise = pendingHydrations.get(docId);
  if (!promise) {
    promise = hydrateDocument(docId, doc).finally(() => {
      pendingHydrations.delete(docId);
    });
    pendingHydrations.set(docId, promise);
  }

  await promise;
  return doc;
}

/**
 * Registers handlers for Yjs document synchronization and updates
 */
export function registerYjsSyncHandlers(socket: Socket, realtimeServer: RealtimeServer): void {
  const user = socket.data.user;
  if (!user) return;

  // 1. Client requests sync step 1: Send server state vector
  socket.on(SocketEvents.YJS_SYNC_STEP_1, async (payload) => {
    try {
      const { docId, stateVector } = payload;
      const roomName = `plan:${docId}`;

      // Ensure user is actually in this socket room
      if (!socket.rooms.has(roomName)) {
        console.warn(`Socket ${socket.id} tried to sync doc ${docId} without joining room`);
        return;
      }

      // Load document from DB if not already in memory
      const doc = await getOrLoadDocument(docId);

      // Encode server state vector
      const serverSV = encodeStateVector(doc);

      // Reply with sync step 1 (server's state vector)
      socket.emit(SocketEvents.YJS_SYNC_STEP_1, {
        docId,
        stateVector: serverSV,
      });

      // Also calculate updates server has that client is missing
      if (stateVector) {
        const clientSV = new Uint8Array(stateVector);
        const serverUpdate = encodeStateAsUpdateWithVector(doc, clientSV);
        
        // If there are updates, emit step 2 to client
        if (serverUpdate.byteLength > 0) {
          socket.emit(SocketEvents.YJS_SYNC_STEP_2, {
            docId,
            update: serverUpdate,
          });
        }
      }
    } catch (err) {
      console.error(`Sync Step 1 error on socket ${socket.id}:`, err);
    }
  });

  // 2. Client sends missing updates to server
  socket.on(SocketEvents.YJS_SYNC_STEP_2, async (payload) => {
    try {
      const { docId, update } = payload;
      const roomName = `plan:${docId}`;

      if (!socket.rooms.has(roomName)) return;

      const doc = await getOrLoadDocument(docId);
      const updateBuffer = Buffer.from(update);

      // Apply update locally to server doc
      applyUpdateToDoc(doc, updateBuffer, socket.id);

      // Persist update in MongoDB
      await YjsPersistenceRepository.appendUpdate(docId, updateBuffer);

      // Broadcast update to other clients in room
      socket.to(roomName).emit(SocketEvents.YJS_UPDATE, {
        docId,
        update: updateBuffer,
      });

      // Synchronize in-memory Y.Doc on other cluster nodes via Redis
      if (pubClient) {
        const msg = JSON.stringify({
          sender: serverInstanceId,
          docId,
          update: updateBuffer.toString("base64"),
        });
        await pubClient.publish("yjs:cluster-updates", msg);
      }
    } catch (err) {
      console.error(`Sync Step 2 error on socket ${socket.id}:`, err);
    }
  });

  // 3. Client broadcasts real-time document mutations (incremental edits)
  socket.on(SocketEvents.YJS_UPDATE, async (payload) => {
    try {
      const { docId, update } = payload;
      const roomName = `plan:${docId}`;

      if (!socket.rooms.has(roomName)) return;

      const doc = await getOrLoadDocument(docId);
      const updateBuffer = Buffer.from(update);

      // Apply locally to server doc representation
      applyUpdateToDoc(doc, updateBuffer, socket.id);

      // Persist delta in DB
      await YjsPersistenceRepository.appendUpdate(docId, updateBuffer);

      // Broadcast update to all other room clients
      socket.to(roomName).emit(SocketEvents.YJS_UPDATE, {
        docId,
        update: updateBuffer,
      });

      // Synchronize across server instances in the cluster
      if (pubClient) {
        const msg = JSON.stringify({
          sender: serverInstanceId,
          docId,
          update: updateBuffer.toString("base64"),
        });
        await pubClient.publish("yjs:cluster-updates", msg);
      }
    } catch (err) {
      console.error(`Yjs update error on socket ${socket.id}:`, err);
    }
  });

  // 4. Client broadcasts ephemeral presence mutations (cursors, highlights)
  socket.on(SocketEvents.AWARENESS_UPDATE, (payload) => {
    const { docId } = payload;
    const roomName = `plan:${docId}`;

    if (!socket.rooms.has(roomName)) return;

    // Ephemeral updates are broadcast immediately without database persistence
    socket.to(roomName).emit(SocketEvents.AWARENESS_UPDATE, payload);
  });
}

/**
 * Subscribes to Redis cluster channel for server-to-server updates
 */
export async function initializeClusterSync(redisSub: any): Promise<void> {
  await redisSub.subscribe("yjs:cluster-updates");
  
  redisSub.on("message", (channel: string, message: string) => {
    if (channel !== "yjs:cluster-updates") return;

    try {
      const data = JSON.parse(message);
      
      // If sent by this instance, skip to avoid loopback
      if (data.sender === serverInstanceId) return;

      const doc = documentRegistry.get(data.docId);
      if (doc) {
        const updateBuffer = Buffer.from(data.update, "base64");
        
        // Apply update to in-memory doc
        applyUpdateToDoc(doc, updateBuffer, "cluster-redis");
        
        // Broadcast to clients connected locally to this instance
        io.to(`plan:${data.docId}`).emit(SocketEvents.YJS_UPDATE, {
          docId: data.docId,
          update: updateBuffer,
        });
      }
    } catch (err) {
      console.error("Error processing cluster update message:", err);
    }
  });
}
