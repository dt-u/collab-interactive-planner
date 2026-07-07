import { Redis } from "ioredis";
import { environmentConfig } from "@collab-planner/config";
import { REDIS_CHANNELS } from "@collab-planner/realtime-protocol";

class RedisPublisher {
  private client: Redis | null = null;

  constructor() {
    const redisUri = environmentConfig.REDIS_URI;
    if (redisUri) {
      this.client = new Redis(redisUri, {
        maxRetriesPerRequest: null,
      });

      this.client.on("error", (err) => {
        console.error("Redis Publisher Client Error:", err);
      });
    }
  }

  async publishNotification(recipientId: string, notification: any): Promise<void> {
    if (!this.client) {
      console.warn("Redis client not initialized. Cannot publish notification.");
      return;
    }

    try {
      const payload = JSON.stringify({ recipientId, notification });
      await this.client.publish(REDIS_CHANNELS.NOTIFICATIONS, payload);
    } catch (err) {
      console.error("Failed to publish notification to Redis:", err);
    }
  }
}

export const redisPublisher = new RedisPublisher();
