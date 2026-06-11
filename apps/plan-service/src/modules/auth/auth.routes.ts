import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { oauthCallbackRequestSchema } from "@collab-planner/shared";

const router = Router();
const controller = new AuthController();

router.get("/google/url", controller.getAuthUrl);
router.post(
  "/google/callback",
  validateBody(oauthCallbackRequestSchema),
  controller.googleCallback,
);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

export default router;
