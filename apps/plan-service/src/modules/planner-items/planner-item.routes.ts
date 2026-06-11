import { Router } from "express";
import { PlannerItemController } from "./planner-item.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import {
  createPlannerItemRequestSchema,
  updatePlannerItemRequestSchema,
} from "@collab-planner/shared";

const router = Router();
const controller = new PlannerItemController();

// Plan-scoped endpoints
router.post(
  "/plans/:planId/items",
  authMiddleware,
  validateBody(createPlannerItemRequestSchema),
  controller.createItem,
);
router.get("/plans/:planId/items", authMiddleware, controller.getItems);

// Individual item endpoints
router.patch(
  "/items/:id",
  authMiddleware,
  validateBody(updatePlannerItemRequestSchema),
  controller.updateItem,
);
router.delete("/items/:id", authMiddleware, controller.deleteItem);

export default router;
