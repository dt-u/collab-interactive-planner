import { REDIS_CHANNELS } from "@collab-planner/realtime-protocol";
import { RealtimeServer } from "../server.js";

/**
 * Subscribes to Redis notification channel and routes messages to active user socket rooms
 */
export async function initializeNotificationSync(redisSub: any, io: RealtimeServer): Promise<void> {
  await redisSub.subscribe(REDIS_CHANNELS.NOTIFICATIONS);

  redisSub.on("message", (channel: string, message: string) => {
    if (channel !== REDIS_CHANNELS.NOTIFICATIONS) return;

    try {
      const { recipientId, notification } = JSON.parse(message);

      // Route the notification payload to the user's specific room
      const userRoom = `user:${recipientId}`;
      io.to(userRoom).emit("notification:received", notification);
    } catch (err) {
      console.error("Error processing incoming Redis notification event:", err);
    }
  });
}
