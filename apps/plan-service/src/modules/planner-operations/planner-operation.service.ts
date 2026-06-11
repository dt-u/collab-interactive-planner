import { PlannerOperationRepository } from "./planner-operation.repository.js";
import { PlannerRepository } from "../planners/planner.repository.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { PlannerOperationMapper } from "./planner-operation.mapper.js";
import { PlannerOperationDto } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";

export class PlannerOperationService {
  constructor(
    private operationRepository: PlannerOperationRepository = new PlannerOperationRepository(),
    private plannerRepository: PlannerRepository = new PlannerRepository(),
    private workspaceRepository: WorkspaceRepository = new WorkspaceRepository(),
  ) {}

  async getPlanOperations(
    planId: string,
    userId: string,
  ): Promise<PlannerOperationDto[]> {
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

    const ops = await this.operationRepository.findByPlan(planId);
    return ops.map((op) => PlannerOperationMapper.toDto(op));
  }

  async logOperation(
    planId: string,
    userId: string,
    operationType: string,
    payload: Record<string, unknown>,
    session?: any,
  ): Promise<PlannerOperationDto> {
    const op = await this.operationRepository.create(
      {
        planId: planId as any,
        userId: userId as any,
        operationType,
        payload,
      },
      session,
    );
    return PlannerOperationMapper.toDto(op);
  }
}
