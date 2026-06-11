import mongoose, { Schema, Document } from "mongoose";

export interface IWorkspaceMember {
  userId: mongoose.Types.ObjectId;
  role: "owner" | "admin" | "member";
}

export interface IWorkspace extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  ownerId: mongoose.Types.ObjectId;
  members: IWorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["owner", "admin", "member"],
    required: true,
    default: "member",
  },
});

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [WorkspaceMemberSchema], default: [] },
  },
  { timestamps: true },
);

export const WorkspaceModel = mongoose.model<IWorkspace>(
  "Workspace",
  WorkspaceSchema,
);
