import { PlannerRepository } from "./planner.repository.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { PlannerMapper } from "./planner.mapper.js";
import { PlanDto, CreatePlanRequest, UpdatePlanRequest } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { YjsSnapshotModel, YjsUpdateLogModel } from "./planner.model.js";

export class PlannerService {
  constructor(
    private plannerRepository: PlannerRepository = new PlannerRepository(),
    private workspaceRepository: WorkspaceRepository = new WorkspaceRepository(),
  ) {}

  async createPlan(
    workspaceId: string,
    creatorId: string,
    data: CreatePlanRequest,
  ): Promise<PlanDto> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const isMember = workspace.members.some(
      (m) => m.userId._id.toString() === creatorId,
    );
    if (!isMember) {
      throw new AppError(
        "Access denied. You are not a member of this workspace.",
        403,
        "FORBIDDEN",
      );
    }

    const plan = await this.plannerRepository.create({
      name: data.name,
      description: data.description,
      workspaceId: workspaceId as any,
      creatorId: creatorId as any,
    });

    return PlannerMapper.toDto(plan);
  }

  async getPlanDetails(planId: string, userId: string): Promise<PlanDto> {
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

    return PlannerMapper.toDto(plan);
  }

  async getWorkspacePlans(
    workspaceId: string,
    userId: string,
  ): Promise<PlanDto[]> {
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

    const plans = await this.plannerRepository.findByWorkspace(workspaceId);
    return plans.map((p) => PlannerMapper.toDto(p));
  }

  async updatePlan(
    planId: string,
    userId: string,
    data: UpdatePlanRequest,
  ): Promise<PlanDto> {
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

    const member = workspace.members.find(
      (m) => m.userId._id.toString() === userId,
    );
    const isCreator = plan.creatorId.toString() === userId;
    const isPrivileged =
      member && (member.role === "owner" || member.role === "admin");

    if (!isCreator && !isPrivileged) {
      throw new AppError(
        "Access denied. You do not have permission to update this plan.",
        403,
        "FORBIDDEN",
      );
    }

    const updated = await this.plannerRepository.update(planId, data);
    if (!updated) {
      throw new AppError("Failed to update plan", 500, "PLAN_UPDATE_FAILED");
    }

    return PlannerMapper.toDto(updated);
  }

  async deletePlan(planId: string, userId: string): Promise<void> {
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

    if (workspace.ownerId.toString() !== userId) {
      throw new AppError(
        "Access denied. Only the workspace owner can delete this plan.",
        403,
        "FORBIDDEN",
      );
    }

    // Cascade delete Yjs CRDT artifacts
    await YjsSnapshotModel.deleteMany({ docId: planId }).exec();
    await YjsUpdateLogModel.deleteMany({ docId: planId }).exec();

    await this.plannerRepository.delete(planId);
  }
}
