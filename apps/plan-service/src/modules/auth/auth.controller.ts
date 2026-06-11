import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { UserMapper } from "../users/user.mapper.js";
import { environmentConfig } from "@collab-planner/config";

const REFRESH_COOKIE_NAME = "refresh_token";

const cookieOptions = {
  httpOnly: true,
  secure: environmentConfig.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  constructor(private authService: AuthService = new AuthService()) {}

  getAuthUrl = (req: Request, res: Response): void => {
    const url = this.authService.getGoogleAuthUrl();
    res.status(200).json({ success: true, data: { url } });
  };

  googleCallback = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { code } = req.body;
      if (!code) {
        res
          .status(400)
          .json({
            success: false,
            error: { message: "Auth code is required" },
          });
        return;
      }

      const { user, tokens } =
        await this.authService.authenticateWithGoogle(code);

      // Embed refresh token in secure cookie
      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, cookieOptions);

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          user: UserMapper.toDto(user),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: { message: "No refresh token provided", code: "UNAUTHORIZED" },
        });
        return;
      }

      const tokens = await this.authService.refreshSession(refreshToken);

      // Rotate/Extend the Refresh Token
      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, cookieOptions);

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
        },
      });
    } catch (error) {
      // Clear cookie if refresh verification failed
      res.clearCookie(REFRESH_COOKIE_NAME);
      next(error);
    }
  };

  logout = (req: Request, res: Response): void => {
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.status(200).json({ success: true, data: { message: "Logged out" } });
  };
}
