// src/routes/category.ts
import express from "express";
import {
  getCategoriesByType,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController";
import { protect, authorize } from "../middleware/authMiddleware";
import { ROLES } from "../constants/roles";
import { apiLimiter } from "../middleware/rateLimitMiddleware";

const router = express.Router();

// Public routes
router.get("/:type", apiLimiter, getCategoriesByType);

// Protected routes (Super-Admin + Editor)
router.use(protect);
router.use(authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR));

router.get("/", getAllCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
