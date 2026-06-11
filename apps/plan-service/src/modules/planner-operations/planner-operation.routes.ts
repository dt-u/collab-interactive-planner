import { Router } from "express";
import { PlannerOperationController } from "./planner-operation.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = Router();
const controller = new PlannerOperationController();

router.get(
  "/plans/:planId/operations",
  authMiddleware,
  controller.getPlanOperations,
);

export default router;
