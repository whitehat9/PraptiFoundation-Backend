import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { Types } from "mongoose";
import CopyPhotoModel from "../models/copyPhotoModel";
import CategoryModel from "../models/categoryModel";
import cloudinary from "../config/cloudinaryConfig";
import logger from "../utils/logger";

const resolvePhotoCategory = async (category: string) => {
  if (!category || typeof category !== "string") {
    throw new Error("Category is required");
  }
  let doc = Types.ObjectId.isValid(category)
    ? await CategoryModel.findOne({ _id: category, type: "photo" })
    : null;
  if (!doc) {
    doc = await CategoryModel.findOne({ name: category, type: "photo" });
  }
  if (!doc) throw new Error(`Invalid photo category: ${category}`);
  return doc;
};

/**
 * @route POST /api/copy-photos/upload-multiple
 * @access Private (Admin)
 */
export const uploadCopyPhotos = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400);
      throw new Error("No files uploaded");
    }

    const files = req.files as Express.Multer.File[];
    const { title, category, description, location, date, altTexts } = req.body;

    if (!title || !category) {
      res.status(400);
      throw new Error("title and category are required");
    }

    const categoryDoc = await resolvePhotoCategory(category);

    let altTextsArray: string[] = [];
    if (typeof altTexts === "string") {
      try {
        altTextsArray = JSON.parse(altTexts);
      } catch {
        altTextsArray = [altTexts];
      }
    } else if (Array.isArray(altTexts)) {
      altTextsArray = altTexts;
    }

    const uploadPromises = files.map(
      (file, index) =>
        new Promise<{ src: string; alt: string; cloudinaryPublicId: string }>(
          (resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                {
                  folder: "prapti-foundation-copy-photos",
                  resource_type: "image",
                  transformation: [
                    { width: 1200, height: 800, crop: "fill", gravity: "auto" },
                    { quality: "auto" },
                    { format: "auto" },
                  ],
                },
                (err, result) => {
                  if (err || !result)
                    return reject(err || new Error("Upload failed"));
                  resolve({
                    src: result.secure_url,
                    alt: altTextsArray[index] || title,
                    cloudinaryPublicId: result.public_id,
                  });
                },
              )
              .end(file.buffer);
          },
        ),
    );

    let uploadedImages;
    try {
      uploadedImages = await Promise.all(uploadPromises);
    } catch (err: any) {
      res.status(502);
      throw new Error(`Image upload failed: ${err.message}`);
    }

    let photo;
    try {
      photo = await CopyPhotoModel.create({
        images: uploadedImages,
        title,
        category: categoryDoc._id,
        description: description || undefined,
        location: location || undefined,
        date: date ? new Date(date) : undefined,
      });
    } catch (err: any) {
      await Promise.allSettled(
        uploadedImages.map((img) =>
          cloudinary.uploader.destroy(img.cloudinaryPublicId),
        ),
      );
      logger.error("CopyPhoto create failed:", err);
      res.status(400);
      throw new Error(err.message);
    }

    await photo.populate("category", "name type");
    res.status(201).json({ success: true, data: photo });
  },
);

/**
 * @route GET /api/copy-photos
 * @access Public
 */
export const getCopyPhotos = asyncHandler(
  async (_req: Request, res: Response) => {
    const photos = await CopyPhotoModel.find({ isActive: true })
      .populate("category", "name type")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: photos });
  },
);

/**
 * @route GET /api/copy-photos/:id
 * @access Public
 */
export const getCopyPhotoById = asyncHandler(
  async (req: Request, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Invalid photo id");
    }
    const photo = await CopyPhotoModel.findById(req.params.id)
      .populate("category", "name type")
      .lean();
    if (!photo) {
      res.status(404);
      throw new Error("Photo not found");
    }
    res.status(200).json({ success: true, data: photo });
  },
);

/**
 * @route DELETE /api/copy-photos/:id
 * @access Private (Admin)
 */
export const deleteCopyPhoto = asyncHandler(
  async (req: Request, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Invalid photo id");
    }
    const photo = await CopyPhotoModel.findById(req.params.id);
    if (!photo) {
      res.status(404);
      throw new Error("Photo not found");
    }

    // Guard fires inside findByIdAndDelete → catch 409
    try {
      await CopyPhotoModel.findByIdAndDelete(req.params.id);
    } catch (err: any) {
      if (err?.code === "PHOTO_IN_USE") {
        res.status(409);
        throw new Error(err.message);
      }
      throw err;
    }

    await Promise.allSettled(
      photo.images.map((img) =>
        cloudinary.uploader.destroy(img.cloudinaryPublicId),
      ),
    );

    res.status(200).json({ success: true, message: "Photo deleted" });
  },
);
