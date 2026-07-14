import mongoose from "mongoose";
import { MediaRepository } from "./media.repository.js";
import { PlannerItemRepository } from "../planner-items/planner-item.repository.js";
import { PlannerRepository } from "../planners/planner.repository.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { MediaMapper } from "./media.mapper.js";
import { MediaDto } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";

export class MediaService {
  constructor(
    private mediaRepository: MediaRepository = new MediaRepository(),
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

  async createMedia(
    itemId: string,
    uploaderId: string,
    data: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      isCover?: boolean;
    },
    planId?: string,
  ): Promise<MediaDto> {
    await this.checkItemAccess(itemId, uploaderId, planId);

    const media = await this.mediaRepository.create({
      itemId: itemId as any,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploaderId: uploaderId as any,
      isCover: data.isCover || false,
    });

    return MediaMapper.toDto(media);
  }

  async getItemMedia(itemId: string, userId: string, planId?: string): Promise<MediaDto[]> {
    await this.checkItemAccess(itemId, userId, planId);
    const list = await this.mediaRepository.findByItem(itemId);
    return list.map((m) => MediaMapper.toDto(m));
  }

  async deleteMedia(mediaId: string, userId: string, planId?: string): Promise<void> {
    const media = await this.mediaRepository.findById(mediaId);
    if (!media) {
      throw new AppError("Media not found", 404, "MEDIA_NOT_FOUND");
    }

    const { workspace } = await this.checkItemAccess(
      media.itemId,
      userId,
      planId,
    );

    const isUploader = media.uploaderId.toString() === userId;
    const member = workspace.members.find(
      (m) => m.userId._id.toString() === userId,
    );
    const isPrivileged =
      member && (member.role === "owner" || member.role === "admin");

    if (!isUploader && !isPrivileged) {
      throw new AppError(
        "Access denied. You do not have permission to delete this media file.",
        403,
        "FORBIDDEN",
      );
    }

    await this.mediaRepository.delete(mediaId);
  }
}
