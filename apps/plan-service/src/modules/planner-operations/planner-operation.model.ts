import mongoose, { Schema, Document } from "mongoose";

export interface IPlannerOperation extends Document {
  _id: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  operationType: string; // e.g., 'item_moved', 'item_created'
  payload: Record<string, unknown>;
  createdAt: Date;
}

const PlannerOperationSchema = new Schema<IPlannerOperation>(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    operationType: { type: String, required: true },
    payload: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PlannerOperationModel = mongoose.model<IPlannerOperation>(
  "PlannerOperation",
  PlannerOperationSchema,
);
