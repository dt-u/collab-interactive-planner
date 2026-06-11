import mongoose from "mongoose";
import { MediaModel, IMedia } from "./media.model.js";

export class MediaRepository {
  async findById(id: string): Promise<IMedia | null> {
    return MediaModel.findById(id).exec();
  }

  async findByItem(itemId: string): Promise<IMedia[]> {
    return MediaModel.find({ itemId }).sort({ createdAt: 1 }).exec();
  }

  async create(
    mediaData: Partial<IMedia>,
    session?: mongoose.ClientSession,
  ): Promise<IMedia> {
    const media = new MediaModel(mediaData);
    return media.save({ session });
  }

  async delete(
    id: string,
    session?: mongoose.ClientSession,
  ): Promise<IMedia | null> {
    return MediaModel.findByIdAndDelete(id, { session }).exec();
  }
}
