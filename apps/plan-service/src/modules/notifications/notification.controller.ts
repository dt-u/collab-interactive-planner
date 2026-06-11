import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service.js";

export class NotificationController {
  constructor(
    private notificationService: NotificationService = new NotificationService(),
  ) {}

  getUserNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const list = await this.notificationService.getUserNotifications(userId);
      res.status(200).json({
        success: true,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const notification = await this.notificationService.markAsRead(
        id,
        userId,
      );
      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      await this.notificationService.markAllAsRead(userId);
      res.status(200).json({
        success: true,
        data: { message: "All notifications marked as read" },
      });
    } catch (error) {
      next(error);
    }
  };
}
