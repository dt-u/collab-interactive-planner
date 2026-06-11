import mongoose, { Schema, Document } from "mongoose";

export interface IPlannerItem extends Document {
  _id: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  columnId: string; // YYYY-MM-DD date or section ID
  position: number; // Order position in the column list
  status: "todo" | "in_progress" | "done";
  assignees: mongoose.Types.ObjectId[];
  creatorId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlannerItemSchema = new Schema<IPlannerItem>(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    columnId: { type: String, required: true, index: true },
    position: { type: Number, required: true },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      required: true,
      default: "todo",
    },
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Compounded index to guarantee unique positions inside a column
PlannerItemSchema.index({ planId: 1, columnId: 1, position: 1 });

export const PlannerItemModel = mongoose.model<IPlannerItem>(
  "PlannerItem",
  PlannerItemSchema,
);
