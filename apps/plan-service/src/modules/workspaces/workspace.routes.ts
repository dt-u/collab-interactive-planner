import { Router } from "express";
import { WorkspaceController } from "./workspace.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import {
  createWorkspaceRequestSchema,
  inviteMemberRequestSchema,
} from "@collab-planner/shared";

const router = Router();
const controller = new WorkspaceController();

router.use(authMiddleware);

router.post("/", validateBody(createWorkspaceRequestSchema), controller.create);
router.get("/", controller.list);
router.get("/:id", controller.get);
router.post(
  "/:id/invite",
  validateBody(inviteMemberRequestSchema),
  controller.invite,
);

export default router;
