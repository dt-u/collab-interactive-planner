import { z } from "zod";

export const joinRoomSchema = z.object({
  workspaceId: z.string().min(1),
  planId: z.string().min(1),
  token: z.string().min(1), // Auth validation
});
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

export const leaveRoomSchema = z.object({
  workspaceId: z.string().min(1),
  planId: z.string().min(1),
});
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;

export const realtimeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type RealtimeErrorPayload = z.infer<typeof realtimeErrorSchema>;
