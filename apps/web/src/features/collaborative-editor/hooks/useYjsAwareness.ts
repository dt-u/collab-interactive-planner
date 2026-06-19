import { useEffect, useState, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getRandomCursorColor } from "@collab-planner/yjs-utils";
import { SocketEvents, AwarenessPayload, AwarenessState } from "@collab-planner/realtime-protocol";

export interface RemoteCursor {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  x?: number; // 0 to 1
  y?: number; // 0 to 1
  focusedItemId?: string;
  lastActive: number;
}

export function useYjsAwareness(
  socket: Socket | null,
  docId: string | undefined,
  currentUser: { id: string; name: string; avatarUrl?: string } | null,
  containerRef: React.RefObject<HTMLElement>
) {
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const throttledUpdateTimer = useRef<any>(null);
  const lastUpdateTimes = useRef<Record<number, number>>({});

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
      // payload structure matches ClientToServerEvents["awareness:update"]
      // but payload has docId on the server broadcast
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
    (cursorPos?: { x: number; y: number }, focusedItemId?: string) => {
      if (!socket || !docId || !currentUser) return;

      const myClientId = getClientId();
      const state: AwarenessState = {
        user: {
          userId: currentUser.id,
          name: currentUser.name,
          color: getRandomCursorColor(currentUser.id),
          avatarUrl: currentUser.avatarUrl,
        },
        cursor: cursorPos,
        focusedItemId,
      };

      socket.emit(SocketEvents.AWARENESS_UPDATE as any, {
        docId,
        clientId: myClientId,
        state,
      });
    },
    [socket, docId, currentUser, getClientId]
  );

  // Throttled mouse move listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !socket || !docId || !currentUser) return;

    let pendingPos: { x: number; y: number } | null = null;
    let lastSent = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width;
      const relativeY = (e.clientY - rect.top) / rect.height;

      // Clamp coordinates between 0 and 1
      const x = Math.max(0, Math.min(1, relativeX));
      const y = Math.max(0, Math.min(1, relativeY));

      const now = Date.now();
      const timeSinceLast = now - lastSent;

      if (timeSinceLast >= 50) {
        lastSent = now;
        sendLocalAwareness({ x, y });
        if (throttledUpdateTimer.current) {
          clearTimeout(throttledUpdateTimer.current);
          throttledUpdateTimer.current = null;
        }
      } else {
        pendingPos = { x, y };
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

    container.addEventListener("mousemove", handleMouseMove);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
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

  return {
    remoteCursors: Object.values(remoteCursors),
    updateFocusedItem,
  };
}
