import mongoose from "mongoose";
import {
  PlannerOperationModel,
  IPlannerOperation,
} from "./planner-operation.model.js";

export class PlannerOperationRepository {
  async create(
    data: Partial<IPlannerOperation>,
    session?: mongoose.ClientSession,
  ): Promise<IPlannerOperation> {
    const op = new PlannerOperationModel(data);
    return op.save({ session });
  }

  async findByPlan(planId: string): Promise<IPlannerOperation[]> {
    return PlannerOperationModel.find({ planId })
      .sort({ createdAt: -1 })
      .exec();
  }
}
