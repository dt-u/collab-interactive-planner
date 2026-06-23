import { Router } from "express";
import { PlannerController } from "./planner.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { createPlanRequestSchema, updatePlanRequestSchema } from "@collab-planner/shared";

const router = Router();
const controller = new PlannerController();

// Workspace-scoped plan endpoints
router.post(
  "/workspaces/:workspaceId/plans",
  authMiddleware,
  validateBody(createPlanRequestSchema),
  controller.createPlan,
);
router.get(
  "/workspaces/:workspaceId/plans",
  authMiddleware,
  controller.getWorkspacePlans,
);

// Individual plan endpoints
router.get("/plans/:id", authMiddleware, controller.getPlanDetails);
router.patch(
  "/plans/:id",
  authMiddleware,
  validateBody(updatePlanRequestSchema),
  controller.updatePlan,
);
router.delete("/plans/:id", authMiddleware, controller.deletePlan);

export default router;
