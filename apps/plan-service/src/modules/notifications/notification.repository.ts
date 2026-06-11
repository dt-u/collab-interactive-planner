import mongoose from "mongoose";
import { NotificationModel, INotification } from "./notification.model.js";

export class NotificationRepository {
  async findById(id: string): Promise<INotification | null> {
    return NotificationModel.findById(id).exec();
  }

  async findUserNotifications(recipientId: string): Promise<INotification[]> {
    return NotificationModel.find({ recipientId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(
    notificationData: Partial<INotification>,
    session?: mongoose.ClientSession,
  ): Promise<INotification> {
    const notification = new NotificationModel(notificationData);
    return notification.save({ session });
  }

  async markAsRead(
    id: string,
    session?: mongoose.ClientSession,
  ): Promise<INotification | null> {
    return NotificationModel.findByIdAndUpdate(
      id,
      { read: true },
      { new: true, session },
    ).exec();
  }

  async markAllAsRead(
    recipientId: string,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    await NotificationModel.updateMany(
      { recipientId, read: false },
      { read: true },
    )
      .session(session || null)
      .exec();
  }
}
