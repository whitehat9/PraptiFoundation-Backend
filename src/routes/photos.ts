import express from "express";
import {
  createPhoto,
  uploadPhoto,
  uploadMultiplePhotos,
  getPhotos,
  getPhoto,
  updatePhoto,
  updatePhotoWithFile,
  deletePhoto,
} from "../controllers/photoController";
import { protect, authorize } from "../middleware/authMiddleware";
import { ROLES } from "../constants/roles";
import { photoUploadConfig, handleMulterError } from "../config/multerConfig";

const router = express.Router();

// Public routes
router.get("/", getPhotos);
router.get("/:id", getPhoto);

// Protected routes (Super-Admin + Editor)
router.post(
  "/",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  createPhoto,
);

// Single photo upload
router.post(
  "/upload",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  photoUploadConfig.single("photo"),
  handleMulterError,
  uploadPhoto,
);

// Multiple photos upload
router.post(
  "/upload-multiple",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  photoUploadConfig.array("photos", 10), // Max 10 photos
  handleMulterError,
  uploadMultiplePhotos,
);

// Update photo metadata only (JSON)
router.patch(
  "/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  updatePhoto,
);

// Update photo with file upload (form-data)
router.patch(
  "/:id/upload",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  photoUploadConfig.single("photo"),
  handleMulterError,
  updatePhotoWithFile,
);

router.delete(
  "/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  deletePhoto,
);

export default router;
