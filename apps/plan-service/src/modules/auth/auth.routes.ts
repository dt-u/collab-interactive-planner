import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { oauthCallbackRequestSchema } from "@collab-planner/shared";

const router = Router();
const controller = new AuthController();

router.get("/google/url", controller.getAuthUrl);

router.get("/google/callback", (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const scope = req.query.scope;
  
  const host = req.headers.host || "localhost:3000";
  let targetOrigin = `http://${host}`;
  if (host.includes(":3001")) {
    targetOrigin = "http://localhost:3000";
  }
  
  const frontendUrl = new URL("/auth/google/callback", targetOrigin);
  if (code) frontendUrl.searchParams.set("code", code as string);
  if (state) frontendUrl.searchParams.set("state", state as string);
  if (scope) frontendUrl.searchParams.set("scope", scope as string);
  
  res.redirect(frontendUrl.toString());
});

router.post(
  "/google/callback",
  validateBody(oauthCallbackRequestSchema),
  controller.googleCallback,
);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

export default router;
