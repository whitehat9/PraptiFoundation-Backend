// src/routes/contact.ts
import express from "express";
import { protect } from "../middleware/authMiddleware";
import { formLimiter } from "../middleware/rateLimitMiddleware";

import {
  sendMessage,
  getMessages,
  getMessageById,
  markAsRead,
  deleteMessage,
} from "../controllers/contact.controller";

const router = express.Router();

// Public routes
router.post(
  "/send",
  formLimiter, // Rate limit contact form submissions
  sendMessage,
);

// Protected routes (Admin only)
router.get("/get", protect, getMessages);

router.get("/:id", protect, getMessageById);

router.patch("/:id/read", protect, markAsRead);

router.delete("/:id", protect, deleteMessage);

export default router;
