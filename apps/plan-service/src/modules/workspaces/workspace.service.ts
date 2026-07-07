import { WorkspaceRepository } from "./workspace.repository.js";
import { UserRepository } from "../users/user.repository.js";
import { WorkspaceMapper } from "./workspace.mapper.js";
import { WorkspaceDto, MemberRole, UpdateWorkspaceRequest } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { PlanModel, YjsSnapshotModel, YjsUpdateLogModel } from "../planners/planner.model.js";

export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository = new WorkspaceRepository(),
    private userRepository: UserRepository = new UserRepository(),
  ) {}

  async createWorkspace(name: string, ownerId: string): Promise<WorkspaceDto> {
    const workspace = await this.workspaceRepository.create({
      name,
      ownerId: ownerId as any,
      members: [{ userId: ownerId as any, role: "owner" }],
    });
    // Populate member info to return complete DTO
    const populated = await this.workspaceRepository.findById(
      workspace._id.toString(),
    );
    if (!populated) throw new AppError("Failed to retrieve workspace", 500);
    return WorkspaceMapper.toDto(populated);
  }

  async getUserWorkspaces(userId: string): Promise<WorkspaceDto[]> {
    const list = await this.workspaceRepository.findUserWorkspaces(userId);
    return list.map((w) => WorkspaceMapper.toDto(w));
  }

  async getWorkspaceDetails(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceDto> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const isMember = workspace.members.some(
      (m) => m.userId._id.toString() === userId,
    );
    if (!isMember) {
      throw new AppError(
        "Access denied. You are not a member of this workspace.",
        403,
        "FORBIDDEN",
      );
    }

    return WorkspaceMapper.toDto(workspace);
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    data: UpdateWorkspaceRequest,
  ): Promise<WorkspaceDto> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const member = workspace.members.find(
      (m) => m.userId._id.toString() === userId,
    );
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new AppError(
        "Access denied. Only owners or admins can update this workspace.",
        403,
        "FORBIDDEN",
      );
    }

    const updated = await this.workspaceRepository.update(workspaceId, data);
    if (!updated) {
      throw new AppError("Failed to update workspace", 500);
    }

    return WorkspaceMapper.toDto(updated);
  }

  async inviteMember(
    workspaceId: string,
    inviterId: string,
    email: string,
    role: MemberRole,
  ): Promise<WorkspaceDto> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    // Verify inviter permissions (only owner or admin can invite)
    const inviter = workspace.members.find(
      (m) => m.userId._id.toString() === inviterId,
    );
    if (!inviter || (inviter.role !== "owner" && inviter.role !== "admin")) {
      throw new AppError(
        "Access denied. Only owners or admins can invite members.",
        403,
        "FORBIDDEN",
      );
    }

    // Find recipient by email
    const targetUser = await this.userRepository.findByEmail(email);
    if (!targetUser) {
      throw new AppError(
        "User with this email does not exist",
        404,
        "USER_NOT_FOUND",
      );
    }

    // Check if already a member
    const alreadyMember = workspace.members.some(
      (m) => m.userId._id.toString() === targetUser._id.toString(),
    );
    if (alreadyMember) {
      throw new AppError(
        "User is already a member of this workspace",
        400,
        "ALREADY_MEMBER",
      );
    }

    const updated = await this.workspaceRepository.addMember(
      workspaceId,
      targetUser._id.toString(),
      role,
    );
    if (!updated) throw new AppError("Failed to add member to workspace", 500);

    return WorkspaceMapper.toDto(updated);
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    if (workspace.ownerId.toString() !== userId) {
      throw new AppError(
        "Access denied. Only the workspace owner can delete this workspace.",
        403,
        "FORBIDDEN",
      );
    }

    // Find all plans in the workspace to cascade delete Yjs snapshots & logs
    const plans = await PlanModel.find({ workspaceId }).exec();
    for (const plan of plans) {
      const planId = plan._id.toString();
      await YjsSnapshotModel.deleteMany({ docId: planId }).exec();
      await YjsUpdateLogModel.deleteMany({ docId: planId }).exec();
    }

    // Clean up all plans associated with the workspace from database
    await PlanModel.deleteMany({ workspaceId }).exec();

    // Delete the workspace document
    await this.workspaceRepository.delete(workspaceId);
  }

  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const member = workspace.members.find(
      (m) => m.userId._id.toString() === userId,
    );
    if (!member) {
      throw new AppError("Access denied. You are not a member of this workspace.", 403, "FORBIDDEN");
    }

    if (member.role === "owner" || workspace.ownerId.toString() === userId) {
      throw new AppError("Access denied. Workspace owners cannot leave. Delete the workspace instead.", 400, "BAD_REQUEST");
    }

    await this.workspaceRepository.removeMember(workspaceId, userId);
  }
}
