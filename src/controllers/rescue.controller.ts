import asyncHandler from "express-async-handler";
import { Request, Response, NextFunction } from "express";
import RescuePostModel from "../models/rescueModel";
import { Types } from "mongoose";
import cloudinary from "../config/cloudinaryConfig";
import logger from "../utils/logger";

/**
 * @desc    Get all rescue posts
 * @route   GET /api/rescue/get
 * @access  Public
 */
export const getRescuePost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, search } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [rescuePosts, total] = await Promise.all([
      RescuePostModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      RescuePostModel.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: rescuePosts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  },
);

/**
 * @desc    Get rescue post by ID
 * @route   GET /api/rescue/get/:id
 * @access  Public
 */
export const getByIdRescuePost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid rescue post ID format");
    }

    const rescuePost = await RescuePostModel.findById(id);

    if (!rescuePost) {
      res.status(404);
      throw new Error("Rescue post not found");
    }

    res.status(200).json({
      success: true,
      data: rescuePost,
    });
  },
);

/**
 * @desc    Create rescue post
 * @route   POST /api/rescue/create
 * @access  Private (Admin)
 */
export const createRescuePost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!title || !description) {
      res.status(400);
      throw new Error("Title and description are required");
    }

    if (!files?.beforeImage || !files?.afterImage) {
      res.status(400);
      throw new Error("Both before and after images are required");
    }

    try {
      // Upload both images
      const [beforeResult, afterResult] = await Promise.all([
        new Promise<any>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "prapti-foundation-rescue",
                resource_type: "image",
                transformation: [
                  { width: 1200, height: 800, crop: "fill" },
                  { quality: "auto" },
                  { format: "auto" },
                ],
              },
              (error, result) => (error ? reject(error) : resolve(result)),
            )
            .end(files.beforeImage[0].buffer);
        }),
        new Promise<any>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "prapti-foundation-rescue",
                resource_type: "image",
                transformation: [
                  { width: 1200, height: 800, crop: "fill" },
                  { quality: "auto" },
                  { format: "auto" },
                ],
              },
              (error, result) => (error ? reject(error) : resolve(result)),
            )
            .end(files.afterImage[0].buffer);
        }),
      ]);

      const rescuePost = await RescuePostModel.create({
        title: title.trim(),
        description: description.trim(),
        beforeImage: beforeResult.secure_url,
        afterImage: afterResult.secure_url,
      });

      logger.info(`Rescue post created: ${rescuePost._id}`);

      res.status(201).json({
        success: true,
        message: "Rescue post created successfully",
        data: rescuePost,
      });
    } catch (error: any) {
      logger.error(`Failed to create rescue post: ${error.message}`);
      res.status(500);
      throw new Error(`Failed to upload images: ${error.message}`);
    }
  },
);
/**
 * @desc    Update rescue post
 * @route   PATCH /api/rescue/update/:id
 * @access  Private (Admin)
 */
export const updateRescuePost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const {
      title,
      description,
      imageAction,
      imageType, // "before" or "after"
    } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid rescue post ID format");
    }

    const rescuePost = await RescuePostModel.findById(id);
    if (!rescuePost) {
      res.status(404);
      throw new Error("Rescue post not found");
    }

    // Handle image operations
    if (imageAction) {
      switch (imageAction) {
        case "add": {
          if (!req.file) {
            res.status(400);
            throw new Error("No file uploaded for image addition");
          }

          if (!imageType || !["before", "after"].includes(imageType)) {
            res.status(400);
            throw new Error('imageType must be "before" or "after"');
          }

          try {
            const uploadResult = await new Promise<any>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  folder: "prapti-foundation-rescue",
                  resource_type: "image",
                  transformation: [
                    { width: 1200, height: 800, crop: "fill" },
                    { quality: "auto" },
                    { format: "auto" },
                  ],
                },
                (error, result) => {
                  if (error) {
                    logger.error(`Cloudinary upload failed: ${error.message}`);
                    reject(error);
                  } else {
                    resolve(result);
                  }
                },
              );
              uploadStream.end(req.file!.buffer);
            });

            // Delete old image from Cloudinary
            const oldImageUrl =
              imageType === "before"
                ? rescuePost.beforeImage
                : rescuePost.afterImage;

            const oldPublicId = extractPublicIdFromUrl(oldImageUrl);
            if (oldPublicId) {
              try {
                await cloudinary.uploader.destroy(oldPublicId);
                logger.info(`Deleted old ${imageType} image: ${oldPublicId}`);
              } catch (error: any) {
                logger.warn(`Failed to delete old image: ${error.message}`);
              }
            }

            // Update with new image
            if (imageType === "before") {
              rescuePost.beforeImage = uploadResult.secure_url;
            } else {
              rescuePost.afterImage = uploadResult.secure_url;
            }

            logger.info(
              `${imageType} image updated for rescue ${id}: ${uploadResult.public_id}`,
            );
          } catch (error: any) {
            res.status(500);
            throw new Error(`Failed to upload image: ${error.message}`);
          }
          break;
        }

        case "delete": {
          res.status(400);
          throw new Error(
            "Cannot delete images. Use 'add' action to replace instead.",
          );
        }

        default:
          res.status(400);
          throw new Error(`Invalid imageAction: "${imageAction}". Use: add`);
      }
    }

    // Update text fields
    if (title !== undefined && title !== null) {
      const trimmedTitle = String(title).trim();
      if (trimmedTitle.length === 0) {
        res.status(400);
        throw new Error("Title cannot be empty");
      }
      rescuePost.title = trimmedTitle;
    }

    if (description !== undefined && description !== null) {
      rescuePost.description = String(description).trim();
    }

    // Save changes
    try {
      const updatedPost = await rescuePost.save();
      logger.info(`Rescue post updated: ${updatedPost._id}`);

      res.status(200).json({
        success: true,
        message: "Rescue post updated successfully",
        data: updatedPost,
      });
    } catch (error: any) {
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message,
        );
        res.status(400);
        throw new Error(`Validation error: ${validationErrors.join(", ")}`);
      }
      logger.error(`Failed to save rescue post: ${error.message}`);
      throw error;
    }
  },
);

/**
 * @desc    Delete rescue post
 * @route   DELETE /api/rescue/del/:id
 * @access  Private (Admin)
 */
export const delRescuePost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid rescue post ID format");
    }

    const rescuePost = await RescuePostModel.findById(id);
    if (!rescuePost) {
      res.status(404);
      throw new Error("Rescue post not found");
    }

    // Delete both images from Cloudinary
    const deletePromises = [
      extractPublicIdFromUrl(rescuePost.beforeImage),
      extractPublicIdFromUrl(rescuePost.afterImage),
    ]
      .filter(Boolean)
      .map(async (publicId) => {
        try {
          const result = await cloudinary.uploader.destroy(publicId!);
          logger.info(
            `Deleted image from Cloudinary: ${publicId}, result: ${result.result}`,
          );
        } catch (error: any) {
          logger.error(
            `Failed to delete image from Cloudinary: ${error.message}`,
          );
        }
      });

    await Promise.allSettled(deletePromises);

    await RescuePostModel.findByIdAndDelete(id);
    logger.info(`Rescue post deleted: ${rescuePost.title}`);

    res.status(200).json({
      success: true,
      message: "Rescue post deleted successfully",
    });
  },
);

/**
 * Helper function to extract Cloudinary public ID from URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/([^\/]+)\.(jpg|jpeg|png|gif|webp)$/i);
    if (matches && matches[1]) {
      // Check if there's a folder path
      const folderMatch = url.match(
        /\/upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|gif|webp)$/i,
      );
      if (folderMatch && folderMatch[1]) {
        return folderMatch[1];
      }
      return matches[1];
    }
    return null;
  } catch (error) {
    logger.error(`Error extracting public ID from URL: ${error}`);
    return null;
  }
}
