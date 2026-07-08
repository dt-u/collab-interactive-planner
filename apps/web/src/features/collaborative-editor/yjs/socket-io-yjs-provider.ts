import * as Y from "yjs";
import { Socket } from "socket.io-client";
import { SocketEvents } from "@collab-planner/realtime-protocol";

// Pure TypeScript implementation of the Yjs Awareness lifecycle API to eliminate Vite resolution issues
export class SimpleAwareness {
  private listeners: Record<string, Function[]> = {};
  public clientID: number;
  public states: Map<number, any> = new Map();

  constructor() {
    this.clientID = Math.floor(Math.random() * 10000000);
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(...args));
  }

  getLocalState() {
    return this.states.get(this.clientID) || null;
  }

  setLocalState(state: any) {
    this.states.set(this.clientID, state);
    this.emit("update", [{ added: [], updated: [this.clientID], removed: [] }, "local"]);
    this.emit("change", [{ added: [], updated: [this.clientID], removed: [] }, "local"]);
  }

  setLocalStateField(key: string, value: any) {
    const current = this.getLocalState() || {};
    current[key] = value;
    this.setLocalState(current);
  }

  getStates() {
    return this.states;
  }
}

export class SocketIoYjsProvider {
  private doc: Y.Doc;
  private socket: Socket;
  private docId: string;
  private isDestroyed = false;
  private listeners: Record<string, Function[]> = {};
  public awareness: SimpleAwareness;

  constructor(docId: string, doc: Y.Doc, socket: Socket) {
    this.docId = docId;
    this.doc = doc;
    this.socket = socket;
    this.awareness = new SimpleAwareness();

    this.init();
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(...args));
  }

  private init() {
    // 1. Listen for socket events from server
    this.socket.on(SocketEvents.YJS_SYNC_STEP_1, this.handleSyncStep1);
    this.socket.on(SocketEvents.YJS_SYNC_STEP_2, this.handleSyncStep2);
    this.socket.on(SocketEvents.YJS_UPDATE, this.handleUpdate);

    // 2. Listen for local Y.Doc mutations
    this.doc.on("update", this.handleLocalUpdate);

    // 3. Initiate sync by sending our state vector to server
    this.triggerSync();
  }

  private triggerSync = () => {
    if (this.isDestroyed) return;
    const stateVector = Y.encodeStateVector(this.doc);
    this.socket.emit(SocketEvents.YJS_SYNC_STEP_1, {
      docId: this.docId,
      stateVector,
    });
  };

  private handleSyncStep1 = (payload: { docId: string; stateVector: Uint8Array | ArrayBuffer }) => {
    if (this.isDestroyed || payload.docId !== this.docId) return;

    // Server requested updates. Send updates server is missing.
    const update = Y.encodeStateAsUpdate(this.doc, new Uint8Array(payload.stateVector));
    if (update.byteLength > 0) {
      this.socket.emit(SocketEvents.YJS_SYNC_STEP_2, {
        docId: this.docId,
        update,
      });
    }
    // Handshake completes
    this.emit("sync", [true]);
  };

  private handleSyncStep2 = (payload: { docId: string; update: Uint8Array | ArrayBuffer }) => {
    if (this.isDestroyed || payload.docId !== this.docId) return;

    // Server sent updates we are missing. Apply them.
    Y.applyUpdate(this.doc, new Uint8Array(payload.update), this);
    // Handshake completes
    this.emit("sync", [true]);
  };

  private handleUpdate = (payload: { docId: string; update: Uint8Array | ArrayBuffer }) => {
    if (this.isDestroyed || payload.docId !== this.docId) return;

    // Remote update received from server. Apply to local Y.Doc.
    Y.applyUpdate(this.doc, new Uint8Array(payload.update), this);
  };

  private handleLocalUpdate = (update: Uint8Array, origin: any) => {
    if (this.isDestroyed || origin === this) return;

    // If update did not originate from this provider, send it to the server
    this.socket.emit(SocketEvents.YJS_UPDATE, {
      docId: this.docId,
      update,
    });
  };

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Unregister socket events
    this.socket.off(SocketEvents.YJS_SYNC_STEP_1, this.handleSyncStep1);
    this.socket.off(SocketEvents.YJS_SYNC_STEP_2, this.handleSyncStep2);
    this.socket.off(SocketEvents.YJS_UPDATE, this.handleUpdate);

    // Unregister Y.Doc events
    this.doc.off("update", this.handleLocalUpdate);
  }
}
