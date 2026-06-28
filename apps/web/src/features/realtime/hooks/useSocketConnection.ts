import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { getSocket, disconnectSocket } from "../socket/socket-client.js";
import { httpClient } from "../../../shared/api/http-client.js";
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
      console.log("Socket connected:", socketInstance.id);
    };

    const onDisconnect = () => {
      console.log("Socket disconnected");
    };

    const onConnectError = async (err: any) => {
      console.warn("Socket connection error:", err.message);
      // If error points to expired token or authentication failure, trigger silent refresh via api request
      if (
        err.message?.includes("expired") || 
        err.message?.includes("auth") || 
        err.message?.includes("token")
      ) {
        console.log("Triggering silent session check to rotate token...");
        try {
          await httpClient.get("/users/me");
        } catch (httpErr) {
          console.error("Session rotation trigger failed:", httpErr);
        }
      }
    };

    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("connect_error", onConnectError);

    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    
    setSocket(socketInstance);

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("disconnect", onDisconnect);
      socketInstance.off("connect_error", onConnectError);
    };
  }, [accessToken]);

  return socket;
}
