import http from "http";
import mongoose from "mongoose";
import { environmentConfig } from "@collab-planner/config";
import { createRealtimeServer, closeRealtimeServer } from "./server.js";
import { startCompactionScheduler } from "./yjs-compaction.worker.js";

const port = environmentConfig.REALTIME_SERVICE_PORT || 3002;
let compactionInterval: NodeJS.Timeout | undefined;

// 1. Setup HTTP Server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "realtime-service", status: "ok" }));
});

// 2. Initialize Socket.IO
createRealtimeServer(server);

// 3. Connect to Database and Listen
async function bootstrap() {
  const mongoUri = environmentConfig.MONGO_URI;

  mongoose.connection.on("connected", () => {
    console.log("🍃 MongoDB connected successfully inside realtime-service");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error in realtime-service:", err);
  });

  try {
    await mongoose.connect(mongoUri);
    console.log("Database connected. Starting HTTP Server...");
    
    // Start compaction scheduler (runs every 60 seconds in dev)
    compactionInterval = startCompactionScheduler(60000);

    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 realtime-service is listening on 0.0.0.0:${port}`);
    });
  } catch (err) {
    console.error("❌ Bootstrap failed:", err);
    process.exit(1);
  }
}

// 4. Graceful Shutdown
async function shutdown(signal: string) {
  console.log(`\n⚠️ Received ${signal}. Shutting down gracefully...`);
  
  if (compactionInterval) {
    clearInterval(compactionInterval);
    console.log("Compaction scheduler stopped.");
  }

  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await closeRealtimeServer();
      console.log("Socket.IO and Redis connections closed.");
      await mongoose.disconnect();
      console.log("MongoDB disconnected.");
      process.exit(0);
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Force shutting down after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap();
