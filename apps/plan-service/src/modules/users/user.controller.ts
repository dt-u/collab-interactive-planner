import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service.js";

export class UserController {
  constructor(private userService: UserService = new UserService()) {}

  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", code: "UNAUTHORIZED" },
        });
        return;
      }
      const profile = await this.userService.getUserProfile(userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };
}
