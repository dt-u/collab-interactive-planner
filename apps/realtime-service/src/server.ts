import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { environmentConfig } from "@collab-planner/config";
import { ServerToClientEvents, ClientToServerEvents } from "@collab-planner/realtime-protocol";
import { socketAuthMiddleware } from "./middleware/socket-auth.middleware.js";
import { registerRoomHandlers } from "./realtime/socket-room.handler.js";
import { registerYjsSyncHandlers, initializeClusterSync } from "./realtime/yjs-sync.handler.js";

export interface SocketData {
  user?: {
    userId: string;
    email: string;
    name: string;
  };
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  any, // InterServerEvents
  SocketData
>;

export let io: RealtimeServer;
export let pubClient: Redis | undefined;
export let subClient: Redis | undefined;

export function createRealtimeServer(httpServer: http.Server): RealtimeServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents, any, SocketData>(httpServer, {
    cors: {
      origin: "*", // In production, match domains or rely on Nginx path routing
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Register Handshake Auth Middleware
  io.use(socketAuthMiddleware);

  const redisUri = environmentConfig.REDIS_URI;
  if (redisUri) {
    console.log(`Initializing Redis Pub/Sub adapter at: ${redisUri}`);
    pubClient = new Redis(redisUri, {
      maxRetriesPerRequest: null,
    });
    subClient = pubClient.duplicate();

    pubClient.on("error", (err: any) => {
      console.error("Redis PubClient Error:", err);
    });

    subClient.on("error", (err: any) => {
      console.error("Redis SubClient Error:", err);
    });

    io.adapter(createAdapter(pubClient, subClient));

    // Initialize cluster sync pub/sub subscription
    initializeClusterSync(subClient).catch(err => {
      console.error("Failed to initialize cluster sync subscription:", err);
    });
  }

  // Handle client connections
  io.on("connection", (socket) => {
    registerRoomHandlers(socket, io);
    registerYjsSyncHandlers(socket, io);
  });

  return io;
}

export async function closeRealtimeServer(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
  if (pubClient) {
    await pubClient.quit();
  }
  if (subClient) {
    await subClient.quit();
  }
}
