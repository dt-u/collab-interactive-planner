import { NotificationDto } from "@collab-planner/shared";
import { INotification } from "./notification.model.js";

export class NotificationMapper {
  static toDto(notification: INotification): NotificationDto {
    return {
      id: notification._id.toString(),
      recipientId: notification.recipientId.toString(),
      senderId: notification.senderId?.toString(),
      type: notification.type,
      title: notification.title,
      content: notification.content,
      read: notification.read,
      metadata:
        notification.metadata instanceof Map
          ? Object.fromEntries(notification.metadata.entries())
          : notification.metadata,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }
}
