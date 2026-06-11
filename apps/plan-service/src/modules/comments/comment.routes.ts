import { Router } from "express";
import { CommentController } from "./comment.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { createCommentRequestSchema } from "@collab-planner/shared";

const router = Router();
const controller = new CommentController();

// Item-scoped comment endpoints
router.post(
  "/items/:itemId/comments",
  authMiddleware,
  validateBody(createCommentRequestSchema),
  controller.createComment,
);
router.get(
  "/items/:itemId/comments",
  authMiddleware,
  controller.getItemComments,
);

// Individual comment endpoints
router.delete("/comments/:id", authMiddleware, controller.deleteComment);

export default router;
