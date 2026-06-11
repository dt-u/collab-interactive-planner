import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "PlannerItem",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

export const CommentModel = mongoose.model<IComment>("Comment", CommentSchema);
