import {
  JoinRoomPayload,
  LeaveRoomPayload,
  RealtimeErrorPayload,
} from "./schemas/realtime-event.schema.js";
import {
  YjsSyncStep1Payload,
  YjsSyncStep2Payload,
  YjsUpdatePayload,
} from "./types/yjs-payload.type.js";
import { AwarenessPayload } from "./types/awareness-payload.type.js";

export interface ServerToClientEvents {
  "room:member-joined": (payload: {
    userId: string;
    name: string;
    avatarUrl?: string;
  }) => void;
  "room:member-left": (payload: { userId: string }) => void;
  "room:presence-update": (
    activeUsers: Array<{
      userId: string;
      name: string;
      avatarUrl?: string;
      color: string;
    }>,
  ) => void;
  "yjs:sync-step-1": (payload: YjsSyncStep1Payload) => void;
  "yjs:sync-step-2": (payload: YjsSyncStep2Payload) => void;
  "yjs:update": (payload: YjsUpdatePayload) => void;
  "awareness:update": (payload: AwarenessPayload) => void;
  "system:error": (payload: RealtimeErrorPayload) => void;
  "notification:received": (payload: {
    id: string;
    recipientId: string;
    senderId?: string;
    type: string;
    title: string;
    content: string;
    read: boolean;
    metadata?: Record<string, any>;
    createdAt: string;
  }) => void;
}

export interface ClientToServerEvents {
  "room:join": (
    payload: JoinRoomPayload,
    callback?: (response: { success: boolean; error?: string }) => void,
  ) => void;
  "room:leave": (payload: LeaveRoomPayload) => void;
  "yjs:sync-step-1": (payload: YjsSyncStep1Payload) => void;
  "yjs:sync-step-2": (payload: YjsSyncStep2Payload) => void;
  "yjs:update": (payload: YjsUpdatePayload) => void;
  "awareness:update": (payload: AwarenessPayload) => void;
}
