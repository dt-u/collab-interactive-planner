import { PlannerOperationDto } from "@collab-planner/shared";
import { IPlannerOperation } from "./planner-operation.model.js";

export class PlannerOperationMapper {
  static toDto(op: IPlannerOperation): PlannerOperationDto {
    return {
      id: op._id.toString(),
      planId: op.planId.toString(),
      userId: op.userId.toString(),
      operationType: op.operationType,
      payload:
        op.payload instanceof Map
          ? Object.fromEntries(op.payload.entries())
          : op.payload,
      createdAt: op.createdAt.toISOString(),
    };
  }
}
