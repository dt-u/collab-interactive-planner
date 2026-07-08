import { useEffect, useState, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getRandomCursorColor } from "@collab-planner/yjs-utils";
import { SocketEvents } from "@collab-planner/realtime-protocol";
import * as Y from "yjs";

export interface RemoteCursor {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  x?: number; // absolute canvas space x coordinate
  y?: number; // absolute canvas space y coordinate
  focusedItemId?: string;
  draggingItemId?: string; // tracks remote user dragging status
  dragProgress?: { itemId: string; type: string; x: number; y: number }; // remote user drag progress
  lastActive: number;
}

// Pure TypeScript implementation of the Yjs Awareness lifecycle API to eliminate Vite resolution issues
class SimpleAwareness {
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

  getStates() {
    return this.states;
  }
}

export function useYjsAwareness(
  socket: Socket | null,
  docId: string | undefined,
  currentUser: { id: string; name: string; avatarUrl?: string } | null,
  containerRef: React.RefObject<HTMLElement>,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom: number = 1,
  yDoc: Y.Doc | null = null
) {
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const throttledUpdateTimer = useRef<any>(null);

  // Instantiate standard Yjs Awareness engine wrapper
  const [awareness] = useState(() => new SimpleAwareness());

  // Store pan and zoom in refs to prevent event listener thrashing
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  // Track state changes via Standard Awareness change / update lifecycle listeners
  useEffect(() => {
    const updatePresenceCallback = () => {
      const states = awareness.getStates();
      const cursors: Record<number, RemoteCursor> = {};

      states.forEach((state: any, clientId: number) => {
        if (clientId === awareness.clientID) return;
        if (!state || !state.user) return;

        cursors[clientId] = {
          clientId,
          userId: state.user.userId,
          name: state.user.name,
          color: state.user.color || getRandomCursorColor(state.user.userId),
          avatarUrl: state.user.avatarUrl,
          x: state.cursor?.x,
          y: state.cursor?.y,
          focusedItemId: state.focusedItemId,
          draggingItemId: state.draggingItemId,
          dragProgress: state.dragProgress,
          lastActive: Date.now(),
        };
      });

      setRemoteCursors(cursors);
    };

    awareness.on("change", updatePresenceCallback);
    awareness.on("update", updatePresenceCallback);

    return () => {
      awareness.off("change", updatePresenceCallback);
      awareness.off("update", updatePresenceCallback);
    };
  }, [awareness]);

  // Sync awareness payload from socket to standard Yjs Awareness engine
  useEffect(() => {
    if (!socket || !docId) return;

    const handleAwarenessUpdate = (payload: any) => {
      if (payload.docId && payload.docId !== docId) return;
      const { clientId, state } = payload;
      if (clientId === awareness.clientID) return;

      if (state === null || state === undefined) {
        awareness.states.delete(clientId);
      } else {
        awareness.states.set(clientId, state);
      }

      // Explicitly trigger standard Yjs awareness lifecycle event emitter
      awareness.emit("change", [{ added: [], updated: [clientId], removed: [] }, "remote"]);
    };

    const handleMemberLeft = (payload: { userId: string }) => {
      let changed = false;
      awareness.getStates().forEach((state: any, clientId: number) => {
        if (state?.user?.userId === payload.userId) {
          awareness.states.delete(clientId);
          changed = true;
        }
      });
      if (changed) {
        awareness.emit("change", [{ added: [], updated: [], removed: [] }, "remote"]);
      }
    };

    socket.on(SocketEvents.AWARENESS_UPDATE, handleAwarenessUpdate);
    socket.on(SocketEvents.MEMBER_LEFT, handleMemberLeft);

    return () => {
      socket.off(SocketEvents.AWARENESS_UPDATE, handleAwarenessUpdate);
      socket.off(SocketEvents.MEMBER_LEFT, handleMemberLeft);
    };
  }, [socket, docId, awareness]);

  // Send local awareness updates (non-destructively updating state keys)
  const sendLocalAwareness = useCallback(
    (overrides: {
      cursor?: { x: number; y: number } | null;
      focusedItemId?: string | null;
      draggingItemId?: string | null;
      dragProgress?: { itemId: string; type: string; x: number; y: number } | null;
    }) => {
      if (!socket || !docId || !currentUser) return;

      const userColor = getRandomCursorColor(currentUser.id);
      const currentState = awareness.getLocalState() || {};

      const nextCursor = overrides.cursor !== undefined
        ? (overrides.cursor === null ? undefined : overrides.cursor)
        : currentState.cursor;

      const nextFocusedItemId = overrides.focusedItemId !== undefined
        ? (overrides.focusedItemId === null ? undefined : overrides.focusedItemId)
        : currentState.focusedItemId;

      const nextDraggingItemId = overrides.draggingItemId !== undefined
        ? (overrides.draggingItemId === null ? undefined : overrides.draggingItemId)
        : currentState.draggingItemId;

      const nextDragProgress = overrides.dragProgress !== undefined
        ? (overrides.dragProgress === null ? undefined : overrides.dragProgress)
        : currentState.dragProgress;

      const state = {
        user: {
          userId: currentUser.id,
          name: currentUser.name,
          color: userColor,
          avatarUrl: currentUser.avatarUrl,
        },
        cursor: nextCursor ? {
          x: nextCursor.x,
          y: nextCursor.y,
        } : undefined,
        focusedItemId: nextFocusedItemId,
        draggingItemId: nextDraggingItemId,
        dragProgress: nextDragProgress,
      };

      awareness.setLocalState(state);

      socket.emit(SocketEvents.AWARENESS_UPDATE as any, {
        docId,
        clientId: awareness.clientID,
        state,
      });
    },
    [socket, docId, currentUser, awareness]
  );

  // Broadcast initial presence state immediately on mount or socket connection
  useEffect(() => {
    if (!socket || !docId || !currentUser) return;
    sendLocalAwareness({});
  }, [socket, docId, currentUser, sendLocalAwareness]);

  // Throttled mouse move listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !socket || !docId || !currentUser) return;

    let pendingPos: { x: number; y: number } | null = null;
    let lastSent = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      
      // client coordinate normalization math relative to pan & zoom
      const normalizedX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const normalizedY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

      const now = Date.now();
      const timeSinceLast = now - lastSent;

      if (timeSinceLast >= 50) {
        lastSent = now;
        sendLocalAwareness({ cursor: { x: normalizedX, y: normalizedY } });
        if (throttledUpdateTimer.current) {
          clearTimeout(throttledUpdateTimer.current);
          throttledUpdateTimer.current = null;
        }
      } else {
        pendingPos = { x: normalizedX, y: normalizedY };
        if (!throttledUpdateTimer.current) {
          throttledUpdateTimer.current = setTimeout(() => {
            if (pendingPos) {
              lastSent = Date.now();
              sendLocalAwareness({ cursor: pendingPos });
              pendingPos = null;
            }
            throttledUpdateTimer.current = null;
          }, 50 - timeSinceLast);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (throttledUpdateTimer.current) {
        clearTimeout(throttledUpdateTimer.current);
      }
    };
  }, [containerRef, socket, docId, currentUser, sendLocalAwareness]);

  const updateFocusedItem = useCallback(
    (focusedItemId: string | undefined) => {
      sendLocalAwareness({ focusedItemId: focusedItemId || null });
    },
    [sendLocalAwareness]
  );

  const updateDraggingItem = useCallback(
    (draggingItemId: string | undefined) => {
      sendLocalAwareness({ draggingItemId: draggingItemId || null });
    },
    [sendLocalAwareness]
  );

  const updateDragProgress = useCallback(
    (dragProgress: { itemId: string; type: string; x: number; y: number } | undefined) => {
      sendLocalAwareness({ dragProgress: dragProgress || null });
    },
    [sendLocalAwareness]
  );

  return {
    remoteCursors: Object.values(remoteCursors),
    updateFocusedItem,
    updateDraggingItem,
    updateDragProgress,
  };
}
