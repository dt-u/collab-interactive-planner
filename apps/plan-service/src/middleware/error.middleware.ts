import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_SERVER_ERROR",
    public details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error("💥 Error encountered:", err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    });
    return;
  }

  if ((err as any).code === 11000) {
    res.status(409).json({
      success: false,
      error: {
        message: "Duplicate resource record found",
        code: "CONFLICT",
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      message: err.message || "An unexpected server error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
