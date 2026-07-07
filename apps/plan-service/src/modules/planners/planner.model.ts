import mongoose, { Schema, Document } from "mongoose";

export interface IPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  workspaceId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    description: { type: String },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const PlanModel = mongoose.model<IPlan>("Plan", PlanSchema);

export const YjsSnapshotModel =
  mongoose.models.YjsSnapshot ||
  mongoose.model(
    "YjsSnapshot",
    new Schema({ docId: { type: String, required: true, unique: true, index: true } })
  );

export const YjsUpdateLogModel =
  mongoose.models.YjsUpdateLog ||
  mongoose.model(
    "YjsUpdateLog",
    new Schema({ docId: { type: String, required: true, index: true } })
  );
