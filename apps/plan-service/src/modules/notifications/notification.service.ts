import { NotificationRepository } from "./notification.repository.js";
import { NotificationMapper } from "./notification.mapper.js";
import { NotificationDto } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { redisPublisher } from "../../shared/redis/redis-publisher.js";

export class NotificationService {
  constructor(
    private notificationRepository: NotificationRepository = new NotificationRepository(),
  ) {}

  async getUserNotifications(userId: string): Promise<NotificationDto[]> {
    const list =
      await this.notificationRepository.findUserNotifications(userId);
    return list.map((n) => NotificationMapper.toDto(n));
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationDto> {
    const notification =
      await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new AppError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND",
      );
    }

    if (notification.recipientId.toString() !== userId) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }

    const updated =
      await this.notificationRepository.markAsRead(notificationId);
    if (!updated) throw new AppError("Failed to update notification", 500);

    return NotificationMapper.toDto(updated);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }

  async createNotification(
    recipientId: string,
    senderId: string | undefined,
    type: string,
    title: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<NotificationDto> {
    const notification = await this.notificationRepository.create({
      recipientId: recipientId as any,
      senderId: senderId ? (senderId as any) : undefined,
      type,
      title,
      content,
      read: false,
      metadata,
    });

    const dto = NotificationMapper.toDto(notification);
    
    // Publish the notification through the Redis pub/sub channel for real-time sync
    await redisPublisher.publishNotification(recipientId, dto);

    return dto;
  }
}
