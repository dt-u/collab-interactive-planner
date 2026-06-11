import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { environmentConfig } from "@collab-planner/config";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: { message: "No access token provided", code: "UNAUTHORIZED" },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, environmentConfig.JWT_SECRET) as {
      userId: string;
      email: string;
      name: string;
    };
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        message: "Invalid or expired access token",
        code: "UNAUTHORIZED",
      },
    });
  }
}
