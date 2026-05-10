import express from "express";

import { protect } from "../middleware/authMiddleware";
import {
  approveVolunteer,
  createVolunteer,
  deleteVolunteerForm,
  getVolunteerById,
  getVolunteerInfo,
  markVolunteerAsRead,
  rejectVolunteer,
} from "../controllers/volunteer.controller";

const router = express.Router();

// POST /api/volunteers/create - create a new volunteer application
//Public
router.post("/create", createVolunteer);

// GET /api/volunteers/info - Get volunteer applications
// Private
router.get("/info", protect, getVolunteerInfo);

// PATCH /api/volunteers/:id/mark-read
router.patch("/:id/mark-read", protect, markVolunteerAsRead);

// PATCH /api/volunteers/:id/approve
router.patch("/:id/approve", protect, approveVolunteer);

// PATCH /api/volunteers/:id/reject
router.patch("/:id/reject", protect, rejectVolunteer);

// GET /api/volunteers/:id - get volunteer by Id
// Private
router.get("/:id", protect, getVolunteerById);

// Del /api/volunteers/:id - del volunteer by Id
// Private
router.delete("/:id", protect, deleteVolunteerForm);

export default router;
