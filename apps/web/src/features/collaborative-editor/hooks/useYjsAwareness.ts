import { useEffect, useState, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getRandomCursorColor } from "@collab-planner/yjs-utils";
import { SocketEvents, AwarenessState } from "@collab-planner/realtime-protocol";

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

export function useYjsAwareness(
  socket: Socket | null,
  docId: string | undefined,
  currentUser: { id: string; name: string; avatarUrl?: string } | null,
  containerRef: React.RefObject<HTMLElement>,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom: number = 1
) {
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const throttledUpdateTimer = useRef<any>(null);

  // Store pan and zoom in refs to prevent event listener thrashing
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  // Keep track of local state properties to merge them during updates
  const localCursorRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const localFocusedItemRef = useRef<string | undefined>(undefined);
  const localDraggingItemRef = useRef<string | undefined>(undefined);
  const localDragProgressRef = useRef<{ itemId: string; type: string; x: number; y: number } | undefined>(undefined);

  const getClientId = useCallback(() => {
    if (!socket?.id) return 0;
    let hash = 0;
    for (let i = 0; i < socket.id.length; i++) {
      hash = socket.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }, [socket]);

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

  // Set up socket awareness event listeners
  useEffect(() => {
    if (!socket || !docId) return;

    const handleAwarenessUpdate = (payload: any) => {
      if (payload.docId && payload.docId !== docId) return;
      
      const { clientId, state } = payload;
      if (!state || !state.user) return;

      // Skip self
      if (clientId === getClientId()) return;

      setRemoteCursors((prev) => ({
        ...prev,
        [clientId]: {
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
        },
      }));
    };

    const handleMemberLeft = (payload: { userId: string }) => {
      setRemoteCursors((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([idStr, cursor]) => {
          if (cursor.userId === payload.userId) {
            delete next[Number(idStr)];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    socket.on(SocketEvents.AWARENESS_UPDATE, handleAwarenessUpdate);
    socket.on(SocketEvents.MEMBER_LEFT, handleMemberLeft);

    return () => {
      socket.off(SocketEvents.AWARENESS_UPDATE, handleAwarenessUpdate);
      socket.off(SocketEvents.MEMBER_LEFT, handleMemberLeft);
    };
  }, [socket, docId, getClientId]);

  // Send local awareness updates (throttled)
  const sendLocalAwareness = useCallback(
    (
      cursorPos?: { x: number; y: number },
      focusedItemId?: string,
      draggingItemId?: string,
      dragProgress?: { itemId: string; type: string; x: number; y: number } | null
    ) => {
      if (!socket || !docId || !currentUser) return;

      if (cursorPos !== undefined) localCursorRef.current = cursorPos;
      if (focusedItemId !== undefined) localFocusedItemRef.current = focusedItemId;
      if (draggingItemId !== undefined) localDraggingItemRef.current = draggingItemId;
      if (dragProgress !== undefined) {
        localDragProgressRef.current = dragProgress === null ? undefined : dragProgress;
      }

      const myClientId = getClientId();
      const userColor = getRandomCursorColor(currentUser.id);
      
      const state: any = {
        user: {
          userId: currentUser.id,
          name: currentUser.name,
          color: userColor,
          avatarUrl: currentUser.avatarUrl,
        },
        cursor: localCursorRef.current ? {
          x: localCursorRef.current.x,
          y: localCursorRef.current.y,
          name: currentUser.name,
          color: userColor,
        } : undefined,
        focusedItemId: localFocusedItemRef.current,
        draggingItemId: localDraggingItemRef.current,
        dragProgress: localDragProgressRef.current,
      };

      socket.emit(SocketEvents.AWARENESS_UPDATE as any, {
        docId,
        clientId: myClientId,
        state,
      });
    },
    [socket, docId, currentUser, getClientId]
  );

  // Broadcast initial presence state immediately on mount or socket connection
  useEffect(() => {
    if (!socket || !docId || !currentUser) return;
    sendLocalAwareness(undefined, undefined, undefined, undefined);
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
        sendLocalAwareness({ x: normalizedX, y: normalizedY });
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
              sendLocalAwareness(pendingPos);
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
      sendLocalAwareness(undefined, focusedItemId);
    },
    [sendLocalAwareness]
  );

  const updateDraggingItem = useCallback(
    (draggingItemId: string | undefined) => {
      sendLocalAwareness(undefined, undefined, draggingItemId);
    },
    [sendLocalAwareness]
  );

  const updateDragProgress = useCallback(
    (dragProgress: { itemId: string; type: string; x: number; y: number } | undefined) => {
      sendLocalAwareness(undefined, undefined, undefined, dragProgress === undefined ? null : dragProgress);
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
