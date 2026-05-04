import express from "express";

import { protect } from "../middleware/authMiddleware";
import {
  createVolunteer,
  deleteVolunteerForm,
  getVolunteerById,
  getVolunteerInfo,
} from "../controllers/volunteer.controller";

const router = express.Router();

// POST /api/volunteers/create - create a new volunteer application
//Public
router.post("/create", createVolunteer);

// GET /api/volunteers/info - Get volunteer applications
// Private
router.get("/info", protect, getVolunteerInfo);

// GET /api/volunteers/:id - get volunteer by Id
// Private
router.get("/:id", protect, getVolunteerById);

// Del /api/volunteers/:id - del volunteer by Id
// Private
router.delete("/:id", protect, deleteVolunteerForm);

export default router;
