import express from "express";
import {
  uploadCopyPhotos,
  getCopyPhotos,
  getCopyPhotoById,
  deleteCopyPhoto,
} from "../controllers/copyPhoto_controller";
import { protect } from "../middleware/authMiddleware";
import { photoUploadConfig, handleMulterError } from "../config/multerConfig";

const router = express.Router();

router.get("/", getCopyPhotos);
router.get("/:id", getCopyPhotoById);

router.post(
  "/upload-multiple",
  protect,
  photoUploadConfig.array("photos", 10),
  handleMulterError,
  uploadCopyPhotos,
);

router.delete("/:id", protect, deleteCopyPhoto);

export default router;
