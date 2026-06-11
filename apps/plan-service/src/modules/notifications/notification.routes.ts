import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);

router.get("/", controller.getUserNotifications);
router.patch("/read-all", controller.markAllAsRead);
router.patch("/:id/read", controller.markAsRead);

export default router;
