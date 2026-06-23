import mongoose from "mongoose";
import { WorkspaceModel, IWorkspace } from "./workspace.model.js";

export class WorkspaceRepository {
  async findById(id: string): Promise<IWorkspace | null> {
    return WorkspaceModel.findById(id).populate("members.userId").exec();
  }

  async findUserWorkspaces(userId: string): Promise<IWorkspace[]> {
    return WorkspaceModel.find({ "members.userId": userId })
      .populate("members.userId")
      .exec();
  }

  async create(
    workspaceData: Partial<IWorkspace>,
    session?: mongoose.ClientSession,
  ): Promise<IWorkspace> {
    const workspace = new WorkspaceModel(workspaceData);
    return workspace.save({ session });
  }

  async update(
    workspaceId: string,
    workspaceData: Partial<Pick<IWorkspace, "name">>,
    session?: mongoose.ClientSession,
  ): Promise<IWorkspace | null> {
    return WorkspaceModel.findByIdAndUpdate(workspaceId, workspaceData, {
      new: true,
      runValidators: true,
      session,
    })
      .populate("members.userId")
      .exec();
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: "owner" | "admin" | "member",
    session?: mongoose.ClientSession,
  ): Promise<IWorkspace | null> {
    return WorkspaceModel.findByIdAndUpdate(
      workspaceId,
      {
        $push: { members: { userId, role } },
      },
      { new: true, session },
    )
      .populate("members.userId")
      .exec();
  }
}
