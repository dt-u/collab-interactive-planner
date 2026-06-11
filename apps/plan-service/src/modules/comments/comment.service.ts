import { CommentRepository } from "./comment.repository.js";
import { PlannerItemRepository } from "../planner-items/planner-item.repository.js";
import { PlannerRepository } from "../planners/planner.repository.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { CommentMapper } from "./comment.mapper.js";
import { CommentDto, CreateCommentRequest } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";

export class CommentService {
  constructor(
    private commentRepository: CommentRepository = new CommentRepository(),
    private itemRepository: PlannerItemRepository = new PlannerItemRepository(),
    private plannerRepository: PlannerRepository = new PlannerRepository(),
    private workspaceRepository: WorkspaceRepository = new WorkspaceRepository(),
  ) {}

  private async checkItemAccess(itemId: string, userId: string) {
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new AppError("Planner item not found", 404, "ITEM_NOT_FOUND");
    }

    const plan = await this.plannerRepository.findById(item.planId.toString());
    if (!plan) {
      throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    const workspace = await this.workspaceRepository.findById(
      plan.workspaceId.toString(),
    );
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

    return { item, plan, workspace };
  }

  async createComment(
    itemId: string,
    userId: string,
    data: CreateCommentRequest,
  ): Promise<CommentDto> {
    await this.checkItemAccess(itemId, userId);

    const comment = await this.commentRepository.create({
      itemId: itemId as any,
      userId: userId as any,
      content: data.content,
    });

    // Populate user details before mapping to DTO
    const populated = await this.commentRepository.findById(
      comment._id.toString(),
    );
    if (!populated) throw new AppError("Failed to retrieve comment", 500);

    return CommentMapper.toDto(populated);
  }

  async getItemComments(itemId: string, userId: string): Promise<CommentDto[]> {
    await this.checkItemAccess(itemId, userId);
    const list = await this.commentRepository.findByItem(itemId);
    return list.map((c) => CommentMapper.toDto(c));
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new AppError("Comment not found", 404, "COMMENT_NOT_FOUND");
    }

    const { workspace } = await this.checkItemAccess(
      comment.itemId.toString(),
      userId,
    );

    const isAuthor = comment.userId.toString() === userId;
    const member = workspace.members.find(
      (m) => m.userId._id.toString() === userId,
    );
    const isPrivileged =
      member && (member.role === "owner" || member.role === "admin");

    if (!isAuthor && !isPrivileged) {
      throw new AppError(
        "Access denied. You do not have permission to delete this comment.",
        403,
        "FORBIDDEN",
      );
    }

    await this.commentRepository.delete(commentId);
  }
}
