import { useEffect, useState, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getRandomCursorColor } from "@collab-planner/yjs-utils";
import { SocketEvents } from "@collab-planner/realtime-protocol";
import { SocketIoYjsProvider } from "../yjs/socket-io-yjs-provider.js";

export interface RemoteCursor {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  x?: number; // relative percentage canvas x coordinate
  y?: number; // relative percentage canvas y coordinate
  focusedItemId?: string;
  draggingItemId?: string; // tracks remote user dragging status
  dragProgress?: { itemId: string; type: string; x: number; y: number }; // remote user drag progress
  lastActive: number;
}

export function useYjsAwareness(
  socket: Socket | null,
  docId: string | undefined,
  currentUser: { id: string; name: string; avatarUrl?: string; color?: string } | null,
  containerRef: React.RefObject<HTMLElement>,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom: number = 1,
  provider: SocketIoYjsProvider | null = null
) {
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const throttledUpdateTimer = useRef<any>(null);

  // Clean up stale cursors (inactive for > 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        
        Object.entries(next).forEach(([idStr, cursor]) => {
          if (now - cursor.lastActive > 5000) {
            delete next[Number(idStr)];
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Send local awareness updates (non-destructively updating state keys)
  const sendLocalAwareness = useCallback(
    (overrides: {
      cursor?: { x: number; y: number } | null;
      focusedItemId?: string | null;
      draggingItemId?: string | null;
      dragProgress?: { itemId: string; type: string; x: number; y: number } | null;
    }) => {
      if (!socket || !docId || !currentUser || !provider) return;

      const userColor = currentUser.color || getRandomCursorColor(currentUser.id);
      const currentState = provider.awareness.getLocalState() || {};

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

      provider.awareness.setLocalState(state);

      socket.emit(SocketEvents.AWARENESS_UPDATE as any, {
        docId,
        clientId: provider.awareness.clientID,
        state,
      });
    },
    [socket, docId, currentUser, provider]
  );

  // Track state changes via Standard Awareness change / update lifecycle listeners and sync connection event
  useEffect(() => {
    if (!provider || !currentUser) return;

    const updatePresenceAndCursorsCallback = () => {
      const states = provider.awareness.getStates();
      const cursors: Record<number, RemoteCursor> = {};

      states.forEach((state: any, clientId: number) => {
        if (clientId === provider.awareness.clientID) return;
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

    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        // 1. Seed user presence
        provider.awareness.setLocalStateField("user", {
          id: currentUser.id,
          name: currentUser.name,
          color: currentUser.color || getRandomCursorColor(currentUser.id),
        });

        // 2. Bind active presence/cursors lifecycle listeners once synced
        provider.awareness.on("change", updatePresenceAndCursorsCallback);
        provider.awareness.on("update", updatePresenceAndCursorsCallback);
      }
    };

    provider.on("sync", handleSync);
    
    // Explicit trigger if provider is already in sync state on re-renders
    if (socket?.connected) {
      handleSync(true);
    }

    return () => {
      provider.off("sync", handleSync);
      provider.awareness.off("change", updatePresenceAndCursorsCallback);
      provider.awareness.off("update", updatePresenceAndCursorsCallback);
    };
  }, [provider, currentUser, socket]);

  // Sync incoming socket awareness payloads to standard Yjs Awareness states map
  useEffect(() => {
    if (!socket || !docId || !provider) return;

    const handleAwarenessUpdate = (payload: any) => {
      if (payload.docId && payload.docId !== docId) return;
      const { clientId, state } = payload;
      if (clientId === provider.awareness.clientID) return;

      if (state === null || state === undefined) {
        provider.awareness.states.delete(clientId);
      } else {
        provider.awareness.states.set(clientId, state);
      }

      // Explicitly trigger the change emitter
      provider.awareness.emit("change", [{ added: [], updated: [clientId], removed: [] }, "remote"]);
    };

    const handleMemberLeft = (payload: { userId: string }) => {
      let changed = false;
      provider.awareness.getStates().forEach((state: any, clientId: number) => {
        if (state?.user?.userId === payload.userId) {
          provider.awareness.states.delete(clientId);
          changed = true;
        }
      });
      if (changed) {
        provider.awareness.emit("change", [{ added: [], updated: [], removed: [] }, "remote"]);
      }
    };

    socket.on(SocketEvents.AWARENESS_UPDATE, handleAwarenessUpdate);
    socket.on(SocketEvents.MEMBER_LEFT, handleMemberLeft);

    return () => {
      socket.off(SocketEvents.AWARENESS_UPDATE, handleAwarenessUpdate);
      socket.off(SocketEvents.MEMBER_LEFT, handleMemberLeft);
    };
  }, [socket, docId, provider]);

  // Throttled mouse move listener tracking percentages of the canvas viewport boundary box
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !socket || !docId || !currentUser || !provider) return;

    let pendingPos: { x: number; y: number } | null = null;
    let lastSent = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      
      const percentX = (e.clientX - rect.left) / rect.width;
      const percentY = (e.clientY - rect.top) / rect.height;

      const now = Date.now();
      const timeSinceLast = now - lastSent;

      if (timeSinceLast >= 50) {
        lastSent = now;
        sendLocalAwareness({ cursor: { x: percentX, y: percentY } });
        if (throttledUpdateTimer.current) {
          clearTimeout(throttledUpdateTimer.current);
          throttledUpdateTimer.current = null;
        }
      } else {
        pendingPos = { x: percentX, y: percentY };
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
  }, [containerRef, socket, docId, currentUser, provider, sendLocalAwareness]);

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
