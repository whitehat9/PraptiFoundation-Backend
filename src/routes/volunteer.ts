import express from "express";

import { protect, authorize } from "../middleware/authMiddleware";
import { ROLES } from "../constants/roles";
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
// Public
router.post("/create", createVolunteer);

// GET /api/volunteers/info - Get volunteer applications
// Private (Super-Admin + Editor)
router.get(
  "/info",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  getVolunteerInfo,
);

// PATCH /api/volunteers/:id/mark-read
router.patch(
  "/:id/mark-read",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  markVolunteerAsRead,
);

// PATCH /api/volunteers/:id/approve
router.patch(
  "/:id/approve",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  approveVolunteer,
);

// PATCH /api/volunteers/:id/reject
router.patch(
  "/:id/reject",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  rejectVolunteer,
);

// GET /api/volunteers/:id - get volunteer by Id
// Private (Super-Admin + Editor)
router.get(
  "/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  getVolunteerById,
);

// DELETE /api/volunteers/:id - delete volunteer by Id
// Private (Super-Admin + Editor)
router.delete(
  "/:id",
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR),
  deleteVolunteerForm,
);

export default router;
