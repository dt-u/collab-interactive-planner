import { Router } from "express";
import { MediaController } from "./media.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const router = Router();
const controller = new MediaController();

router.post("/items/:itemId/media", authMiddleware, upload.single("file"), controller.createMedia);
router.get("/items/:itemId/media", authMiddleware, controller.getItemMedia);
router.delete("/media/:id", authMiddleware, controller.deleteMedia);

export default router;
