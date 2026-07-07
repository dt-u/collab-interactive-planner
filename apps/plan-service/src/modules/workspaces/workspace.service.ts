import { WorkspaceRepository } from "./workspace.repository.js";
import { UserRepository } from "../users/user.repository.js";
import { WorkspaceMapper } from "./workspace.mapper.js";
import { WorkspaceDto, MemberRole, UpdateWorkspaceRequest } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { PlanModel, YjsSnapshotModel, YjsUpdateLogModel } from "../planners/planner.model.js";
import { NotificationService } from "../notifications/notification.service.js";
import { WorkspaceInvitationModel } from "./workspace-invitation.model.js";

export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository = new WorkspaceRepository(),
    private userRepository: UserRepository = new UserRepository(),
    private notificationService: NotificationService = new NotificationService(),
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

    // Check if a pending invitation already exists
    const existingPending = await WorkspaceInvitationModel.findOne({
      workspaceId,
      recipientId: targetUser._id,
      status: "pending",
    });
    if (existingPending) {
      throw new AppError(
        "An invitation is already pending for this user",
        400,
        "ALREADY_PENDING",
      );
    }

    // Create pending workspace invitation record
    const invitation = await WorkspaceInvitationModel.create({
      workspaceId,
      inviterId,
      recipientId: targetUser._id,
      role,
      status: "pending",
    });

    // Create workspace invitation notification
    await this.notificationService.createNotification(
      targetUser._id.toString(),
      inviterId,
      "invitation",
      "Workspace Invitation",
      `You have been invited to join workspace "${workspace.name}"`,
      {
        invitationId: invitation._id.toString(),
        workspaceId: workspaceId,
      },
    );

    return WorkspaceMapper.toDto(workspace);
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<WorkspaceDto> {
    const invitation = await WorkspaceInvitationModel.findById(invitationId);
    if (!invitation || invitation.status !== "pending") {
      throw new AppError("Invitation not found or no longer pending", 404, "INVITATION_NOT_FOUND");
    }

    // Security Boundary: strictly validate recipient ownership to prevent ID hijacking
    if (invitation.recipientId.toString() !== userId) {
      throw new AppError("Access denied. You do not own this invitation.", 403, "FORBIDDEN");
    }

    invitation.status = "accepted";
    await invitation.save();

    const updated = await this.workspaceRepository.addMember(
      invitation.workspaceId.toString(),
      invitation.recipientId.toString(),
      invitation.role,
    );
    if (!updated) throw new AppError("Failed to add member to workspace", 500);

    return WorkspaceMapper.toDto(updated);
  }

  async declineInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await WorkspaceInvitationModel.findById(invitationId);
    if (!invitation || invitation.status !== "pending") {
      throw new AppError("Invitation not found or no longer pending", 404, "INVITATION_NOT_FOUND");
    }

    // Security Boundary: strictly validate recipient ownership to prevent ID hijacking
    if (invitation.recipientId.toString() !== userId) {
      throw new AppError("Access denied. You do not own this invitation.", 403, "FORBIDDEN");
    }

    invitation.status = "declined";
    await invitation.save();
  }

  async getPendingInvitations(userId: string): Promise<any[]> {
    const list = await WorkspaceInvitationModel.find({
      recipientId: userId,
      status: "pending",
    })
      .populate("workspaceId", "name")
      .populate("inviterId", "name email")
      .exec();

    return list.map((inv) => ({
      id: inv._id.toString(),
      workspaceId: inv.workspaceId._id.toString(),
      workspaceName: (inv.workspaceId as any).name,
      inviterName: (inv.inviterId as any).name || "Someone",
      inviterEmail: (inv.inviterId as any).email || "",
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
    }));
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
