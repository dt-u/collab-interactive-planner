import mongoose from "mongoose";
import { PlannerItemModel, IPlannerItem } from "./planner-item.model.js";

export class PlannerItemRepository {
  async findById(id: string): Promise<IPlannerItem | null> {
    return PlannerItemModel.findById(id).exec();
  }

  async findByPlan(planId: string): Promise<IPlannerItem[]> {
    return PlannerItemModel.find({ planId }).sort({ position: 1 }).exec();
  }

  async findByColumn(
    planId: string,
    columnId: string,
  ): Promise<IPlannerItem[]> {
    return PlannerItemModel.find({ planId, columnId })
      .sort({ position: 1 })
      .exec();
  }

  async create(
    itemData: Partial<IPlannerItem>,
    session?: mongoose.ClientSession,
  ): Promise<IPlannerItem> {
    const item = new PlannerItemModel(itemData);
    return item.save({ session });
  }

  async update(
    id: string,
    itemData: Partial<IPlannerItem>,
    session?: mongoose.ClientSession,
  ): Promise<IPlannerItem | null> {
    return PlannerItemModel.findByIdAndUpdate(id, itemData, {
      new: true,
      session,
    }).exec();
  }

  async delete(
    id: string,
    session?: mongoose.ClientSession,
  ): Promise<IPlannerItem | null> {
    return PlannerItemModel.findByIdAndDelete(id, { session }).exec();
  }

  async getMaxPosition(
    planId: string,
    columnId: string,
    session?: mongoose.ClientSession,
  ): Promise<number> {
    const item = await PlannerItemModel.findOne({ planId, columnId })
      .sort({ position: -1 })
      .session(session || null)
      .exec();
    return item ? item.position : -1;
  }

  async shiftPositions(
    planId: string,
    columnId: string,
    fromPosition: number,
    delta: number,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    await PlannerItemModel.updateMany(
      { planId, columnId, position: { $gte: fromPosition } },
      { $inc: { position: delta } },
    )
      .session(session || null)
      .exec();
  }

  async shiftPositionsRange(
    planId: string,
    columnId: string,
    startPos: number,
    endPos: number,
    delta: number,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    await PlannerItemModel.updateMany(
      {
        planId,
        columnId,
        position: { $gte: startPos, $lte: endPos },
      },
      { $inc: { position: delta } },
    )
      .session(session || null)
      .exec();
  }
}
