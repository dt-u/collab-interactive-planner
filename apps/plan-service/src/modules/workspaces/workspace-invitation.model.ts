import mongoose, { Schema, Document } from "mongoose";

export interface IWorkspaceInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  role: "admin" | "member";
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceInvitationSchema = new Schema<IWorkspaceInvitation>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      required: true,
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      required: true,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

export const WorkspaceInvitationModel = mongoose.model<IWorkspaceInvitation>(
  "WorkspaceInvitation",
  WorkspaceInvitationSchema,
);
