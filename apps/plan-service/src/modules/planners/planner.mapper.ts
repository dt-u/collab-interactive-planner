import { PlanDto } from "@collab-planner/shared";
import { IPlan } from "./planner.model.js";

export class PlannerMapper {
  static toDto(plan: IPlan): PlanDto {
    return {
      id: plan._id.toString(),
      name: plan.name,
      description: plan.description,
      workspaceId: plan.workspaceId.toString(),
      creatorId: plan.creatorId.toString(),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
