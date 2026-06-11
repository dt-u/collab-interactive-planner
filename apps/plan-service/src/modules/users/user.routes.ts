import { Router } from "express";
import { UserController } from "./user.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = Router();
const controller = new UserController();

router.get("/me", authMiddleware, controller.getMe);

export default router;
