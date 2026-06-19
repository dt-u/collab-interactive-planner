import { useEffect, useState } from "react";
import { useSocketConnection } from "./useSocketConnection.js";
import { useAuth } from "../../../app/providers/AuthProvider.js";

export function useJoinPlannerRoom(workspaceId: string | undefined, planId: string | undefined) {
  const socket = useSocketConnection();
  const { accessToken } = useAuth();
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket || !workspaceId || !planId || !accessToken) {
      setJoined(false);
      return;
    }

    setLoading(true);
    setError(null);

    socket.emit("room:join", { workspaceId, planId, token: accessToken }, (response) => {
      setLoading(false);
      if (response.success) {
        setJoined(true);
      } else {
        setError(response.error || "Failed to join workspace board");
        setJoined(false);
      }
    });

    return () => {
      socket.emit("room:leave", { workspaceId, planId });
      setJoined(false);
    };
  }, [socket, workspaceId, planId, accessToken]);

  return { joined, loading, error, socket };
}
