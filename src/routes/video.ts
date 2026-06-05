// src/routes/video.ts
import express from "express";
import {
  getVideos,
  getVideoById,
  uploadVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  getVideoCategories,
  getVideoCategoriesWithCounts,
  createVideoCategory,
  updateVideoCategory,
  deleteVideoCategory,
} from "../controllers/videoController";
import { protect, authorize } from "../middleware/authMiddleware";
import { ROLES } from "../constants/roles";
import { apiLimiter } from "../middleware/rateLimitMiddleware";
import { videoUploadConfig, handleMulterError } from "../config/multerConfig";

const router = express.Router();

// Public routes
// Static category routes MUST be registered before "/:id",
// otherwise "/categories" is captured by the "/:id" param route.
router.get("/categories", apiLimiter, getVideoCategories);
router.get("/categories/counts", apiLimiter, getVideoCategoriesWithCounts);

router.get("/", apiLimiter, getVideos);
router.get("/:id", apiLimiter, getVideoById);

// Protected routes (Super-Admin + Editor)
router.use(protect); // All routes below require authentication

// Category management (protected) — keep static paths before "/:id"
router.post(
  "/categories",
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  createVideoCategory,
);
router.put(
  "/categories/:id",
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  updateVideoCategory,
);
router.delete(
  "/categories/:id",
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  deleteVideoCategory,
);

// Video management
router.post(
  "/upload",
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  videoUploadConfig.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  handleMulterError,
  uploadVideo,
);
router.post("/", authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), createVideo);

router.put(
  "/:id",
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  videoUploadConfig.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  handleMulterError,
  updateVideo,
);
router.delete("/:id", authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), deleteVideo);

export default router;
