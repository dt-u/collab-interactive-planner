import { Request, Response, NextFunction } from "express";
import { PlannerItemService } from "./planner-item.service.js";

export class PlannerItemController {
  constructor(
    private itemService: PlannerItemService = new PlannerItemService(),
  ) {}

  createItem = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { planId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const item = await this.itemService.createItem(planId, userId, req.body);
      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  };

  getItems = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { planId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const items = await this.itemService.getItemsByPlan(planId, userId);
      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  };

  updateItem = async (
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

      const item = await this.itemService.updateItem(id, userId, req.body);
      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteItem = async (
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

      await this.itemService.deleteItem(id, userId);
      res.status(200).json({
        success: true,
        data: { message: "Planner item deleted successfully" },
      });
    } catch (error) {
      next(error);
    }
  };
}
