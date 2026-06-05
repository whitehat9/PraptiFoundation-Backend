import express from "express";

import { protect, authorize } from "../middleware/authMiddleware";
import { ROLES } from "../constants/roles";

import {
  validateBlogCreate,
  validateBlogUpdate,
  validateBlogId,
} from "./../middleware/validationMiddleware";
import {
  createBlogPost,
  deleteBlogPost,
  getBlogPost,
  getBlogPostById,
  updateBlogPost,
} from "../controllers/blogs.controller";

const router = express.Router();

// Public routes
router.get("/getAll", getBlogPost);
router.get("/:id", validateBlogId, getBlogPostById);

// Protected routes (Super-Admin + Editor) with validation
router.post(
  "/create",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  validateBlogCreate,
  createBlogPost,
);

router.put(
  "/update/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  validateBlogUpdate,
  updateBlogPost,
);

router.delete(
  "/delete/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  validateBlogId,
  deleteBlogPost,
);

export default router;
