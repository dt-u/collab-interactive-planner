import { Request, Response, NextFunction } from "express";
import { MediaService } from "./media.service.js";

export class MediaController {
  constructor(private mediaService: MediaService = new MediaService()) {}

  createMedia = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const uploaderId = req.user?.userId;
      if (!uploaderId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const planId = (req.query.planId || req.body.planId) as string;
      const media = await this.mediaService.createMedia(
        itemId,
        uploaderId,
        req.body,
        planId,
      );

      res.status(201).json({
        success: true,
        data: media,
      });
    } catch (error) {
      next(error);
    }
  };

  getItemMedia = async (
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
      const media = await this.mediaService.getItemMedia(itemId, userId, planId);

      res.status(200).json({
        success: true,
        data: media,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteMedia = async (
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
      await this.mediaService.deleteMedia(id, userId, planId);

      res.status(200).json({
        success: true,
        data: { message: "Media deleted successfully" },
      });
    } catch (error) {
      next(error);
    }
  };
}
