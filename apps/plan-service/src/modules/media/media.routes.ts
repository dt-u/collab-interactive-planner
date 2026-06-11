import { Router } from "express";
import { MediaController } from "./media.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = Router();
const controller = new MediaController();

router.post("/items/:itemId/media", authMiddleware, controller.createMedia);
router.get("/items/:itemId/media", authMiddleware, controller.getItemMedia);
router.delete("/media/:id", authMiddleware, controller.deleteMedia);

export default router;
