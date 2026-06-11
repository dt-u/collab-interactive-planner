import { WorkspaceDto } from "@collab-planner/shared";
import { IWorkspace } from "./workspace.model.js";

export class WorkspaceMapper {
  static toDto(workspace: IWorkspace): WorkspaceDto {
    return {
      id: workspace._id.toString(),
      name: workspace.name,
      ownerId: workspace.ownerId.toString(),
      members: workspace.members.map((m) => {
        const u = m.userId as any; // Populated User document
        return {
          userId: u._id?.toString() || m.userId.toString(),
          name: u.name || "Unknown User",
          email: u.email || "",
          avatarUrl: u.avatarUrl,
          role: m.role,
        };
      }),
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }
}
