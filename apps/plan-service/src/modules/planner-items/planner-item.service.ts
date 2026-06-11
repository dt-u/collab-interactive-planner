import mongoose from "mongoose";
import { PlannerItemRepository } from "./planner-item.repository.js";
import { PlannerRepository } from "../planners/planner.repository.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { PlannerOperationService } from "../planner-operations/planner-operation.service.js";
import { PlannerItemMapper } from "./planner-item.mapper.js";
import {
  PlannerItemDto,
  CreatePlannerItemRequest,
  UpdatePlannerItemRequest,
} from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { withTransaction } from "../../database/transactions.js";

export class PlannerItemService {
  constructor(
    private itemRepository: PlannerItemRepository = new PlannerItemRepository(),
    private plannerRepository: PlannerRepository = new PlannerRepository(),
    private workspaceRepository: WorkspaceRepository = new WorkspaceRepository(),
    private operationService: PlannerOperationService = new PlannerOperationService(),
  ) {}

  private async checkPlanAccess(planId: string, userId: string) {
    const plan = await this.plannerRepository.findById(planId);
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

    return { plan, workspace };
  }

  async createItem(
    planId: string,
    creatorId: string,
    data: CreatePlannerItemRequest,
  ): Promise<PlannerItemDto> {
    await this.checkPlanAccess(planId, creatorId);

    const result = await withTransaction(async (session) => {
      const maxPos = await this.itemRepository.getMaxPosition(
        planId,
        data.columnId,
        session,
      );

      // Clamp requested position to valid range [0, maxPos + 1]
      let targetPos = data.position;
      if (targetPos > maxPos + 1) {
        targetPos = maxPos + 1;
      }

      // Shift existing items in the column if inserting in between
      if (targetPos <= maxPos) {
        await this.itemRepository.shiftPositions(
          planId,
          data.columnId,
          targetPos,
          1,
          session,
        );
      }

      const item = await this.itemRepository.create(
        {
          planId: planId as any,
          title: data.title,
          description: data.description,
          columnId: data.columnId,
          position: targetPos,
          status: data.status,
          assignees: data.assignees.map(
            (id: string) => new mongoose.Types.ObjectId(id),
          ),
          creatorId: creatorId as any,
        },
        session,
      );

      // Log Planner Operation
      await this.operationService.logOperation(
        planId,
        creatorId,
        "item_created",
        {
          itemId: item._id.toString(),
          title: item.title,
          columnId: item.columnId,
          position: item.position,
        },
        session,
      );

      return item;
    });

    return PlannerItemMapper.toDto(result);
  }

  async getItemsByPlan(
    planId: string,
    userId: string,
  ): Promise<PlannerItemDto[]> {
    await this.checkPlanAccess(planId, userId);
    const items = await this.itemRepository.findByPlan(planId);
    return items.map((item) => PlannerItemMapper.toDto(item));
  }

  async updateItem(
    itemId: string,
    userId: string,
    data: UpdatePlannerItemRequest,
  ): Promise<PlannerItemDto> {
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new AppError("Planner item not found", 404, "ITEM_NOT_FOUND");
    }

    await this.checkPlanAccess(item.planId.toString(), userId);

    const updatedItem = await withTransaction(async (session) => {
      const isColumnChange =
        data.columnId !== undefined && data.columnId !== item.columnId;
      const isPositionChange =
        data.position !== undefined && data.position !== item.position;

      if (isColumnChange || isPositionChange) {
        const oldCol = item.columnId;
        const oldPos = item.position;
        const newCol = data.columnId !== undefined ? data.columnId : oldCol;
        const rawNewPos = data.position !== undefined ? data.position : oldPos;

        const maxPos = await this.itemRepository.getMaxPosition(
          item.planId.toString(),
          newCol,
          session,
        );

        let newPos = rawNewPos;
        if (isColumnChange) {
          if (newPos > maxPos + 1) {
            newPos = maxPos + 1;
          }
        } else {
          if (newPos > maxPos) {
            newPos = maxPos;
          }
        }

        if (oldCol === newCol) {
          // Reorder within the same column
          if (newPos < oldPos) {
            // Shift down by 1 in range [newPos, oldPos - 1]
            await this.itemRepository.shiftPositionsRange(
              item.planId.toString(),
              oldCol,
              newPos,
              oldPos - 1,
              1,
              session,
            );
          } else if (newPos > oldPos) {
            // Shift up by 1 in range [oldPos + 1, newPos]
            await this.itemRepository.shiftPositionsRange(
              item.planId.toString(),
              oldCol,
              oldPos + 1,
              newPos,
              -1,
              session,
            );
          }
        } else {
          // Move to a different column
          // 1. Shift down in old column (subsequent items move up by -1)
          await this.itemRepository.shiftPositions(
            item.planId.toString(),
            oldCol,
            oldPos + 1,
            -1,
            session,
          );

          // 2. Shift up in new column (subsequent items move down by +1)
          await this.itemRepository.shiftPositions(
            item.planId.toString(),
            newCol,
            newPos,
            1,
            session,
          );
        }

        item.columnId = newCol;
        item.position = newPos;
      }

      // Update other fields
      if (data.title !== undefined) item.title = data.title;
      if (data.description !== undefined) item.description = data.description;
      if (data.status !== undefined) item.status = data.status;
      if (data.assignees !== undefined) {
        item.assignees = data.assignees.map(
          (id: string) => new mongoose.Types.ObjectId(id),
        );
      }

      await (item as any).save({ session });

      // Log Planner Operation
      await this.operationService.logOperation(
        item.planId.toString(),
        userId,
        "item_updated",
        {
          itemId: item._id.toString(),
          title: item.title,
          columnId: item.columnId,
          position: item.position,
          changes: data,
        },
        session,
      );

      return item;
    });

    return PlannerItemMapper.toDto(updatedItem);
  }

  async deleteItem(itemId: string, userId: string): Promise<void> {
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new AppError("Planner item not found", 404, "ITEM_NOT_FOUND");
    }

    await this.checkPlanAccess(item.planId.toString(), userId);

    await withTransaction(async (session) => {
      // 1. Delete item
      await this.itemRepository.delete(itemId, session);

      // 2. Shift all subsequent items down by -1
      await this.itemRepository.shiftPositions(
        item.planId.toString(),
        item.columnId,
        item.position + 1,
        -1,
        session,
      );

      // Log Planner Operation
      await this.operationService.logOperation(
        item.planId.toString(),
        userId,
        "item_deleted",
        {
          itemId: item._id.toString(),
          title: item.title,
        },
        session,
      );
    });
  }
}
