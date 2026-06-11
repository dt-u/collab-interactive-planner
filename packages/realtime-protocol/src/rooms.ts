export function getWorkspaceRoomId(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

export function getPlanRoomId(planId: string): string {
  return `plan:${planId}`;
}

export interface RealtimeRooms {
  workspaceRoom: string;
  planRoom: string;
}
