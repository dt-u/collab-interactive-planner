import mongoose from "mongoose";
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

  private async checkItemAccess(itemId: string, userId: string, planId?: string) {
    let workspaceId: string;
    let item: any = null;
    let plan: any = null;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(itemId);
    if (isValidObjectId) {
      item = await this.itemRepository.findById(itemId);
      if (item) {
        plan = await this.plannerRepository.findById(item.planId.toString());
        if (!plan) {
          throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
        }
        workspaceId = plan.workspaceId.toString();
      } else if (planId) {
        plan = await this.plannerRepository.findById(planId);
        if (!plan) {
          throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
        }
        workspaceId = plan.workspaceId.toString();
      } else {
        throw new AppError("Planner item not found", 404, "ITEM_NOT_FOUND");
      }
    } else {
      if (!planId) {
        throw new AppError("planId query parameter is required for custom item IDs", 400, "PLAN_ID_REQUIRED");
      }
      plan = await this.plannerRepository.findById(planId);
      if (!plan) {
        throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
      }
      workspaceId = plan.workspaceId.toString();
    }

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

    return { item, plan, workspace };
  }

  async createComment(
    itemId: string,
    userId: string,
    data: CreateCommentRequest,
    planId?: string,
  ): Promise<CommentDto> {
    await this.checkItemAccess(itemId, userId, planId);

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

  async getItemComments(itemId: string, userId: string, planId?: string): Promise<CommentDto[]> {
    await this.checkItemAccess(itemId, userId, planId);
    const list = await this.commentRepository.findByItem(itemId);
    return list.map((c) => CommentMapper.toDto(c));
  }

  async deleteComment(commentId: string, userId: string, planId?: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new AppError("Comment not found", 404, "COMMENT_NOT_FOUND");
    }

    const { workspace } = await this.checkItemAccess(
      comment.itemId,
      userId,
      planId,
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
