// backend/controllers/volunteer.controller.ts
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { VolunteerModel } from "../models/volunteer.model";
import logger from "../utils/logger";
import {
  sendVolunteerApprovalEmail,
  sendVolunteerRejectionEmail,
} from "../utils/emailService";

export const createVolunteer = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      district,
      state,
      pincode,
      availability,
      interests,
      experience,
      reason,
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !phone) {
      res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
      return;
    }

    // Check duplicate
    const existingVolunteer = await VolunteerModel.findOne({ email });
    if (existingVolunteer) {
      res.status(400).json({
        success: false,
        message: "A volunteer application with this email already exists",
      });
      return;
    }

    // Create volunteer
    const volunteer = await VolunteerModel.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: parseInt(phone, 10),
      address: address?.trim(),
      district: district.trim(),
      state: state.trim(),
      pincode: parseInt(pincode, 10),
      availability,
      interests,
      experience: experience?.trim(),
      reason: reason.trim(),
    });

    logger.info(`New volunteer application: ${email}`);

    res.status(201).json({
      success: true,
      message: "Volunteer application submitted successfully",
      data: {
        id: volunteer._id,
        email: volunteer.email,
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        submittedAt: volunteer.submittedAt,
      },
    });
  },
);

export const getVolunteerInfo = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const volunteers = await VolunteerModel.find({})
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const total = await VolunteerModel.countDocuments();

    res.status(200).json({
      success: true,
      data: volunteers,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total,
        limit: limitNumber,
      },
    });
  },
);

export const getVolunteerById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const volunteer = await VolunteerModel.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true },
    );

    if (!volunteer) {
      res
        .status(404)
        .json({ success: false, message: "Volunteer application not found" });
      return;
    }

    res.status(200).json({ success: true, data: volunteer });
  },
);

export const deleteVolunteerForm = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const volunteer = await VolunteerModel.findById(id);

    if (!volunteer) {
      res.status(404).json({
        success: false,
        message: "Volunteer application not found",
      });
      return;
    }

    await VolunteerModel.findByIdAndDelete(id);

    logger.info(
      `Volunteer application deleted: ${volunteer.email} by ${req.user?.email}`,
    );

    res.status(200).json({
      success: true,
      message: "Volunteer application deleted successfully",
    });
  },
);

export const approveVolunteer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const volunteer = await VolunteerModel.findById(id);
    if (!volunteer) {
      res.status(404).json({ success: false, message: "Volunteer not found" });
      return;
    }

    if (volunteer.status === "approved") {
      res.status(400).json({ success: false, message: "Already approved" });
      return;
    }

    volunteer.status = "approved";
    volunteer.approvedAt = new Date();
    volunteer.rejectionReason = undefined;
    await volunteer.save();

    // Non-blocking — DB update is the source of truth
    sendVolunteerApprovalEmail({
      to: volunteer.email,
      firstName: volunteer.firstName,
      volunteerId: String(volunteer._id),
    }).catch((err) =>
      logger.error(
        `Approval email failed for ${volunteer.email}: ${err.message}`,
      ),
    );

    logger.info(`Volunteer approved: ${volunteer.email} by ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: "Volunteer approved and notified via email",
      data: {
        id: volunteer._id,
        status: volunteer.status,
        approvedAt: volunteer.approvedAt,
      },
    });
  },
);

export const rejectVolunteer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    const volunteer = await VolunteerModel.findById(id);
    if (!volunteer) {
      res.status(404).json({ success: false, message: "Volunteer not found" });
      return;
    }

    if (volunteer.status === "rejected") {
      res.status(400).json({ success: false, message: "Already rejected" });
      return;
    }

    volunteer.status = "rejected";
    volunteer.rejectedAt = new Date();
    if (reason) volunteer.rejectionReason = String(reason).trim().slice(0, 500);
    await volunteer.save();

    sendVolunteerRejectionEmail({
      to: volunteer.email,
      firstName: volunteer.firstName,
      volunteerId: String(volunteer._id),
      reason: volunteer.rejectionReason,
    }).catch((err) =>
      logger.error(
        `Rejection email failed for ${volunteer.email}: ${err.message}`,
      ),
    );

    logger.info(`Volunteer rejected: ${volunteer.email} by ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: "Volunteer rejected and notified via email",
      data: {
        id: volunteer._id,
        status: volunteer.status,
        rejectedAt: volunteer.rejectedAt,
      },
    });
  },
);
export const markVolunteerAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const volunteer = await VolunteerModel.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true, select: "_id isRead" },
    );

    if (!volunteer) {
      res.status(404).json({ success: false, message: "Volunteer not found" });
      return;
    }

    res.status(200).json({ success: true, data: volunteer });
  },
);
