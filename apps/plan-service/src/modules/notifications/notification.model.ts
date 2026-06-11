import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  senderId?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  content: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    read: { type: Boolean, required: true, default: false },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const NotificationModel = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
