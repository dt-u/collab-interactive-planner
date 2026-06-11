import mongoose from "mongoose";
import { UserModel, IUser } from "./user.model.js";

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  async findByGoogleId(googleId: string): Promise<IUser | null> {
    return UserModel.findOne({ googleId }).exec();
  }

  async create(
    userData: Partial<IUser>,
    session?: mongoose.ClientSession,
  ): Promise<IUser> {
    const user = new UserModel(userData);
    return user.save({ session });
  }

  async update(
    id: string,
    userData: Partial<IUser>,
    session?: mongoose.ClientSession,
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, userData, {
      new: true,
      session,
    }).exec();
  }
}
