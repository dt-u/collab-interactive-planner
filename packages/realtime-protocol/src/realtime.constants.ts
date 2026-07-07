export const AWARENESS_THROTTLE_MS = 50; // Throttle cursor updates to 50ms to prevent server flooding
export const SYNC_DEBOUNCE_MS = 2000; // Debounce period for flushing Yjs state to DB

export const REALTIME_CONSTANTS = {
  AWARENESS_THROTTLE_MS,
  SYNC_DEBOUNCE_MS,
} as const;

export const REDIS_CHANNELS = {
  NOTIFICATIONS: "notifications:publish",
} as const;
