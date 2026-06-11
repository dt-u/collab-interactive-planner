import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/users/user.routes.js";
import workspaceRoutes from "../modules/workspaces/workspace.routes.js";
import plannerRoutes from "../modules/planners/planner.routes.js";
import plannerItemRoutes from "../modules/planner-items/planner-item.routes.js";
import commentRoutes from "../modules/comments/comment.routes.js";
import mediaRoutes from "../modules/media/media.routes.js";
import notificationRoutes from "../modules/notifications/notification.routes.js";
import operationRoutes from "../modules/planner-operations/planner-operation.routes.js";

export function registerRoutes(router: Router): void {
  router.use("/auth", authRoutes);
  router.use("/users", userRoutes);
  router.use("/workspaces", workspaceRoutes);
  router.use("/", plannerRoutes);
  router.use("/", plannerItemRoutes);
  router.use("/", commentRoutes);
  router.use("/", mediaRoutes);
  router.use("/notifications", notificationRoutes);
  router.use("/", operationRoutes);
}
