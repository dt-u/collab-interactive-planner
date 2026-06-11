export const SocketEvents = {
  // Room Management
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  MEMBER_JOINED: "room:member-joined",
  MEMBER_LEFT: "room:member-left",
  PRESENCE_UPDATE: "room:presence-update",

  // Yjs Syncing
  YJS_SYNC_STEP_1: "yjs:sync-step-1",
  YJS_SYNC_STEP_2: "yjs:sync-step-2",
  YJS_UPDATE: "yjs:update",

  // Ephemeral Awareness
  AWARENESS_UPDATE: "awareness:update",

  // Errors & System
  ERROR: "system:error",
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];
