import { PlannerItemDto } from "@collab-planner/shared";
import { IPlannerItem } from "./planner-item.model.js";

export class PlannerItemMapper {
  static toDto(item: IPlannerItem): PlannerItemDto {
    return {
      id: item._id.toString(),
      planId: item.planId.toString(),
      title: item.title,
      description: item.description,
      columnId: item.columnId,
      position: item.position,
      status: item.status,
      assignees: item.assignees.map((id) => id.toString()),
      creatorId: item.creatorId.toString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
