import express, { Express, Router } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  const apiRouter = Router();
  registerRoutes(apiRouter);
  app.use("/api", apiRouter);
  app.use("/", apiRouter);

  app.use(errorHandler);

  return app;
}
