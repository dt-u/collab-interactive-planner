import http from "http";
import { createApp } from "./app.js";
import { MongooseConnection } from "./database/mongoose.connection.js";
import { seedDatabase } from "./database/seed/seed.js";

export async function createServer(): Promise<http.Server> {
  // 1. Connect MongoDB
  await MongooseConnection.connect();

  // 2. Run system metadata seeding
  await seedDatabase();

  // 3. Create Express App
  const app = createApp();

  // 4. Wrap in HTTP Server
  const server = http.createServer(app);
  return server;
}
