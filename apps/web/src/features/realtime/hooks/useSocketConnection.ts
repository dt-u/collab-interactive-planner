import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { getSocket, disconnectSocket } from "../socket/socket-client.js";
import { ServerToClientEvents, ClientToServerEvents } from "@collab-planner/realtime-protocol";

export function useSocketConnection(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  const { accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    const socketInstance = getSocket(accessToken);
    
    const onConnect = () => {
      console.log("🟢 Socket connected:", socketInstance.id);
    };

    const onDisconnect = () => {
      console.log("🔴 Socket disconnected");
    };

    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);

    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    
    setSocket(socketInstance);

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("disconnect", onDisconnect);
    };
  }, [accessToken]);

  return socket;
}
