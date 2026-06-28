import { Socket } from "socket.io";
import { getRandomCursorColor } from "@collab-planner/yjs-utils";
import { SocketEvents } from "@collab-planner/realtime-protocol";
import { WorkspaceModel } from "../models/workspace.model.js";
import { PlanModel } from "../models/plan.model.js";
import { RealtimeServer } from "../server.js";

// Helper to broadcast presence update to a room
export async function broadcastPresence(io: RealtimeServer, roomName: string, excludingSocketId?: string): Promise<void> {
  const sockets = await io.in(roomName).fetchSockets();
  
  // Map and deduplicate active users
  const userMap = new Map<string, { userId: string; name: string; color: string }>();
  
  for (const s of sockets) {
    if (s.id === excludingSocketId) continue;
    
    const user = s.data.user;
    if (user) {
      userMap.set(user.userId, {
        userId: user.userId,
        name: user.name,
        color: getRandomCursorColor(user.userId),
      });
    }
  }
  
  const activeUsers = Array.from(userMap.values());
  io.to(roomName).emit("room:presence-update", activeUsers);
}

export function registerRoomHandlers(socket: Socket, io: RealtimeServer): void {
  const user = socket.data.user;
  if (!user) {
    console.error(`SocketRoomHandler: socket.data.user is missing for socket: ${socket.id}`);
    return;
  }

  socket.on(SocketEvents.ROOM_JOIN, async (payload, callback) => {
    try {
      const { workspaceId, planId } = payload;
      
      console.log(`Socket ${socket.id} (User: ${user.email}) requesting to join plan: ${planId} in workspace: ${workspaceId}`);

      // 1. Verify Plan exists and belongs to the workspace
      const plan = await PlanModel.findById(planId);
      if (!plan) {
        console.warn(`Room join failed: Plan ${planId} not found`);
        callback?.({ success: false, error: "Plan not found" });
        return;
      }

      if (plan.workspaceId.toString() !== workspaceId) {
        console.warn(`Room join failed: Plan ${planId} does not belong to workspace ${workspaceId}`);
        callback?.({ success: false, error: "Unauthorized workspace plan combination" });
        return;
      }

      // 2. Verify Workspace exists and user is a member/owner
      const workspace = await WorkspaceModel.findById(workspaceId);
      if (!workspace) {
        console.warn(`Room join failed: Workspace ${workspaceId} not found`);
        callback?.({ success: false, error: "Workspace not found" });
        return;
      }

      const isMember = 
        workspace.ownerId.toString() === user.userId ||
        workspace.members.some(m => m.userId.toString() === user.userId);

      if (!isMember) {
        console.warn(`Room join failed: User ${user.email} is not a member of workspace ${workspaceId}`);
        callback?.({ success: false, error: "UNAUTHORIZED: You do not have access to this workspace" });
        return;
      }

      const roomName = `plan:${planId}`;

      // Join the Socket.IO channel
      await socket.join(roomName);
      console.log(`Socket ${socket.id} successfully joined room: ${roomName}`);

      // Broadcast join event to others
      socket.to(roomName).emit("room:member-joined", {
        userId: user.userId,
        name: user.name,
      });

      // Broadcast updated presence to everyone in the room
      await broadcastPresence(io, roomName);

      callback?.({ success: true });
    } catch (err: any) {
      console.error(`Room join error on socket ${socket.id}:`, err);
      callback?.({ success: false, error: "Internal server error during room join" });
    }
  });

  socket.on(SocketEvents.ROOM_LEAVE, async (payload) => {
    const { planId } = payload;
    const roomName = `plan:${planId}`;
    
    console.log(`Socket ${socket.id} leaving room: ${roomName}`);
    
    // Broadcast member left to others before leaving
    socket.to(roomName).emit("room:member-left", { userId: user.userId });
    
    await socket.leave(roomName);

    // Update presence for the remaining users in the room
    await broadcastPresence(io, roomName);
  });

  // Track client disconnect to clean up presence
  socket.on("disconnecting", () => {
    for (const roomName of socket.rooms) {
      if (roomName.startsWith("plan:")) {
        console.log(`Socket ${socket.id} disconnecting from room: ${roomName}`);
        
        // Notify other clients that this user left
        socket.to(roomName).emit("room:member-left", { userId: user.userId });
        
        // Broadcast presence update excluding this socket ID
        broadcastPresence(io, roomName, socket.id).catch(err => {
          console.error(`Error broadcasting presence on disconnect to room ${roomName}:`, err);
        });
      }
    }
  });
}
