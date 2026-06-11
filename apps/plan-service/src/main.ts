import { createServer } from "./server.js";
import { environmentConfig } from "@collab-planner/config";

const port = Number(environmentConfig.PLAN_SERVICE_PORT || 3001);

async function start(): Promise<void> {
  try {
    const server = await createServer();
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 plan-service is listening on 0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

start();
