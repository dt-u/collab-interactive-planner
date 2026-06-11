import { Request, Response, NextFunction } from "express";
import { PlannerOperationService } from "./planner-operation.service.js";

export class PlannerOperationController {
  constructor(
    private operationService: PlannerOperationService = new PlannerOperationService(),
  ) {}

  getPlanOperations = async (
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

      const list = await this.operationService.getPlanOperations(
        planId,
        userId,
      );
      res.status(200).json({
        success: true,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  };
}
