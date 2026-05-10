import express from "express";
import {
  getCopyAwards,
  getCopyAwardById,
  createCopyAward,
  updateCopyAward,
  deleteCopyAward,
} from "../controllers/copyAward_controller";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/", getCopyAwards);
router.get("/:id", getCopyAwardById);
router.post("/", protect, createCopyAward);
router.patch("/:id", protect, updateCopyAward);
router.delete("/:id", protect, deleteCopyAward);

export default router;
