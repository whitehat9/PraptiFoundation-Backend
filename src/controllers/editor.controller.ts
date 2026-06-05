import asyncHandler from "express-async-handler";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import EditorModel from "../models/editorModel";
import AdminModel from "../models/adminModel";
import logger from "../utils/logger";
import { sendEditorCredentialsEmail } from "../utils/emailService";
import { ErrorResponse } from "../constants/errorResponse";
import { ROLES } from "../constants/roles";

const PASSWORD_LENGTH = 12;

const generateSecurePassword = (): string =>
  crypto.randomBytes(9).toString("base64url").slice(0, PASSWORD_LENGTH);

/**
 * @desc   Create an editor account
 * @route  POST /api/editors
 * @access Private (Super-Admin)
 */
export const createEditor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email } = req.body;
    if (!name?.trim() || !email?.trim()) {
      return next(new ErrorResponse("name and email are required", 400));
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Email must be unique across BOTH collections (shared login space).
    const [editorExists, adminExists] = await Promise.all([
      EditorModel.exists({ email: normalizedEmail }),
      AdminModel.exists({ email: normalizedEmail }),
    ]);
    if (editorExists || adminExists) {
      return next(
        new ErrorResponse("An account with this email already exists", 409),
      );
    }

    const plainPassword = generateSecurePassword();

    const editor = await EditorModel.create({
      name: name.trim(),
      email: normalizedEmail,
      password: plainPassword, // hashed by pre-save hook
    });

    sendEditorCredentialsEmail({
      to: editor.email,
      name: editor.name,
      email: editor.email,
      password: plainPassword,
    }).catch((err) =>
      logger.error(
        `Credential email failed for ${editor.email}: ${err.message}`,
      ),
    );

    logger.info(`Editor created: ${editor.email} by ${req.user?.email}`);

    res.status(201).json({
      success: true,
      message: "Editor account created. Credentials sent via email.",
      data: { id: editor._id, name: editor.name, email: editor.email },
    });
  },
);

/**
 * @desc   List all editors
 * @route  GET /api/editors
 * @access Private (Super-Admin)
 */
export const getEditors = asyncHandler(async (_req: Request, res: Response) => {
  const editors = await EditorModel.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: editors.length, data: editors });
});

/**
 * @desc   Toggle editor active status
 * @route  PATCH /api/editors/:id/status
 * @access Private (Super-Admin)
 */
export const toggleEditorStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const editor = await EditorModel.findById(req.params.id);
    if (!editor) return next(new ErrorResponse("Editor not found", 404));

    editor.isActive = !editor.isActive;
    await editor.save();

    logger.info(
      `Editor ${editor.isActive ? "activated" : "deactivated"}: ${editor.email} by ${req.user?.email}`,
    );

    res.status(200).json({
      success: true,
      message: `Editor ${editor.isActive ? "activated" : "deactivated"}`,
      data: { id: editor._id, isActive: editor.isActive },
    });
  },
);

/**
 * @desc   Delete editor
 * @route  DELETE /api/editors/:id
 * @access Private (Super-Admin)
 */
export const deleteEditor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const editor = await EditorModel.findById(req.params.id);
    if (!editor) return next(new ErrorResponse("Editor not found", 404));

    await editor.deleteOne();
    logger.info(`Editor deleted: ${editor.email} by ${req.user?.email}`);

    res.status(200).json({ success: true, message: "Editor account deleted" });
  },
);

/**
 * @desc   Regenerate & resend editor credentials
 * @route  POST /api/editors/:id/resend-credentials
 * @access Private (Super-Admin)
 */
export const resendEditorCredentials = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const editor = await EditorModel.findById(req.params.id).select(
      "+password",
    );
    if (!editor) return next(new ErrorResponse("Editor not found", 404));

    const newPassword = generateSecurePassword();
    editor.password = newPassword; // re-hashed by pre-save hook
    await editor.save();

    sendEditorCredentialsEmail({
      to: editor.email,
      name: editor.name,
      email: editor.email,
      password: newPassword,
    }).catch((err) =>
      logger.error(
        `Resend credentials failed for ${editor.email}: ${err.message}`,
      ),
    );

    logger.info(`Credentials resent: ${editor.email} by ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: "New credentials sent to editor's email",
    });
  },
);
/**
 * @desc   Editor login
 * @route  POST /api/editor/login
 * @access Public
 */
export const loginEditor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(
        new ErrorResponse("Please provide both email and password", 400),
      );
    }

    const editor = await EditorModel.findOne({
      email: String(email).toLowerCase().trim(),
    }).select("+password");

    if (!editor || !(await editor.matchPassword(password))) {
      logger.info(`Failed editor login attempt for email: ${email}`);
      // Generic message — do not reveal whether the account exists.
      return next(new ErrorResponse("Invalid credentials", 401));
    }

    if (!editor.isActive) {
      return next(new ErrorResponse("Account is deactivated", 403));
    }

    const token = editor.getSignedJwtToken(); // embeds { id, role: "Editor" }

    logger.info(`Editor logged in: ${editor.email}`);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        role: ROLES.EDITOR,
        token,
      },
    });
  },
);

/**
 * @desc   Editor logout
 * @route  POST /api/editor/logout
 * @access Private (Editor)
 */
export const logoutEditor = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.user) {
      logger.info(`Editor logged out: ${req.user.email}`);
    }
    res.status(200).json({ success: true, message: "Logout successful" });
  },
);
