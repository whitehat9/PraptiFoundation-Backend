import express from "express";
import {
  createAwardPost,
  delAwardPost,
  getAwardPost,
  getByIdAwardPost,
  updateAwardPost,
  uploadAward,
  uploadMultipleAwards,
} from "../controllers/award.controller";
import { protect, authorize } from "../middleware/authMiddleware";
import { ROLES } from "../constants/roles";
import { handleMulterError, photoUploadConfig } from "../config/multerConfig";

const router = express.Router();

// ── Write routes: Super-Admin + Editor ──────────────────────────
router.post(
  "/create",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  createAwardPost,
);

// Single photo upload
router.post(
  "/upload",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  photoUploadConfig.single("image"),
  handleMulterError,
  uploadAward,
);

// Multiple photos upload
router.post(
  "/upload-multiple",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  photoUploadConfig.array("images", 10), // Max 10 photos
  handleMulterError,
  uploadMultipleAwards,
);

router.patch(
  "/update/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  photoUploadConfig.single("image"),
  handleMulterError,
  updateAwardPost,
);

router.delete(
  "/del/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  delAwardPost,
);

// ── Read routes: public ─────────────────────────────────────────
router.get("/get", getAwardPost);
router.get("/get/:id", getByIdAwardPost);

export default router;
