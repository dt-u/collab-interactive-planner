import mongoose, { Schema, Document } from "mongoose";

export interface IMedia extends Document {
  _id: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploaderId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "PlannerItem",
      required: true,
      index: true,
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const MediaModel = mongoose.model<IMedia>("Media", MediaSchema);
