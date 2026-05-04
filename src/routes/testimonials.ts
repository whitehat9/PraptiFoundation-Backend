// src/routes/testimonials.ts
import express from "express";
import {
  getTestimonials,
  getTestimonialById,
  getFeaturedTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getTestimonialStats,
  getActiveTestimonials,
} from "../controllers/testimonialController";
import { protect } from "../middleware/authMiddleware";
import { apiLimiter, formLimiter } from "../middleware/rateLimitMiddleware";

const router = express.Router();

// Public routes
router.get("/", apiLimiter, getTestimonials);
router.get("/active", apiLimiter, getActiveTestimonials);
router.get("/featured", apiLimiter, getFeaturedTestimonials);
router.get("/:id", apiLimiter, getTestimonialById); //no component

// Protected routes (Admin only)

router.get("/admin/stats", getTestimonialStats);
router.post("/", formLimiter, createTestimonial); //admin cant post only public
router.put("/:id", protect, updateTestimonial);
router.delete("/:id", protect, deleteTestimonial);

export default router;
