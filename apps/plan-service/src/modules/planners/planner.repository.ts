import mongoose from "mongoose";
import { PlanModel, IPlan } from "./planner.model.js";

export class PlannerRepository {
  async findById(id: string): Promise<IPlan | null> {
    return PlanModel.findById(id).exec();
  }

  async findByWorkspace(workspaceId: string): Promise<IPlan[]> {
    return PlanModel.find({ workspaceId }).exec();
  }

  async create(
    planData: Partial<IPlan>,
    session?: mongoose.ClientSession,
  ): Promise<IPlan> {
    const plan = new PlanModel(planData);
    return plan.save({ session });
  }

  async delete(
    id: string,
    session?: mongoose.ClientSession,
  ): Promise<IPlan | null> {
    return PlanModel.findByIdAndDelete(id, { session }).exec();
  }
}
