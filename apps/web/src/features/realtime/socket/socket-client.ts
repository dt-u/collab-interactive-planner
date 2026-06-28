import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "@collab-planner/realtime-protocol";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(token: string): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) {
    const currentToken = (socket.auth as any)?.token;
      
    if (currentToken !== token) {
      console.log("Socket token changed. Reconnecting socket...");
      socket.disconnect();
      socket = null;
    }
  }

  if (!socket) {
    socket = io({
      path: "/socket.io/",
      auth: { token },
      autoConnect: false,
      transports: ["websocket"] // enforce websocket transport for real-time collaboration
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    console.log("Disconnecting Socket...");
    socket.disconnect();
    socket = null;
  }
}
