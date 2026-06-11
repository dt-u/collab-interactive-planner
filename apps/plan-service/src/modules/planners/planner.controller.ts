import { Request, Response, NextFunction } from "express";
import { PlannerService } from "./planner.service.js";

export class PlannerController {
  constructor(private plannerService: PlannerService = new PlannerService()) {}

  createPlan = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const plan = await this.plannerService.createPlan(
        workspaceId,
        userId,
        req.body,
      );

      res.status(201).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  };

  getWorkspacePlans = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const plans = await this.plannerService.getWorkspacePlans(
        workspaceId,
        userId,
      );

      res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  };

  getPlanDetails = async (
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

      const plan = await this.plannerService.getPlanDetails(id, userId);

      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  };

  deletePlan = async (
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

      await this.plannerService.deletePlan(id, userId);

      res.status(200).json({
        success: true,
        data: { message: "Plan deleted successfully" },
      });
    } catch (error) {
      next(error);
    }
  };
}
