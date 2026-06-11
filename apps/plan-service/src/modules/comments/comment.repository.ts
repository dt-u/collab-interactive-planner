import mongoose from "mongoose";
import { CommentModel, IComment } from "./comment.model.js";

export class CommentRepository {
  async findById(id: string): Promise<IComment | null> {
    return CommentModel.findById(id).exec();
  }

  async findByItem(itemId: string): Promise<IComment[]> {
    return CommentModel.find({ itemId })
      .sort({ createdAt: 1 })
      .populate("userId")
      .exec();
  }

  async create(
    commentData: Partial<IComment>,
    session?: mongoose.ClientSession,
  ): Promise<IComment> {
    const comment = new CommentModel(commentData);
    return comment.save({ session });
  }

  async delete(
    id: string,
    session?: mongoose.ClientSession,
  ): Promise<IComment | null> {
    return CommentModel.findByIdAndDelete(id, { session }).exec();
  }
}
