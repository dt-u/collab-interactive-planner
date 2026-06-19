import { Request, Response, NextFunction } from "express";
import { CommentService } from "./comment.service.js";

export class CommentController {
  constructor(private commentService: CommentService = new CommentService()) {}

  createComment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const planId = (req.query.planId || req.body.planId) as string;
      const comment = await this.commentService.createComment(
        itemId,
        userId,
        req.body,
        planId,
      );

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  };

  getItemComments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const planId = req.query.planId as string;
      const comments = await this.commentService.getItemComments(
        itemId,
        userId,
        planId,
      );

      res.status(200).json({
        success: true,
        data: comments,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteComment = async (
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

      const planId = req.query.planId as string;
      await this.commentService.deleteComment(id, userId, planId);

      res.status(200).json({
        success: true,
        data: { message: "Comment deleted successfully" },
      });
    } catch (error) {
      next(error);
    }
  };
}
