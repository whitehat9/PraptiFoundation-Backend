import asyncHandler from "express-async-handler";
import { Request, Response, NextFunction } from "express";
import CategoryModel from "../models/categoryModel";
import AwardPostModel from "../models/awardModel";
import cloudinary from "../config/cloudinaryConfig";
import logger from "../utils/logger";
import mongoose, { Types } from "mongoose";

/**
 * @desc    Get all award posts
 * @route   GET /api/awards
 * @access  Public
 */
export const getAwardPost = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const awards = await AwardPostModel.find({})
        .populate("category", "name type")
        .sort({ createdAt: -1 });

      res.status(200).json(awards);
    } catch (error: any) {
      logger.error("Error fetching Award posts:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching Award posts",
        error: error.message,
      });
    }
  },
);
/**
 * @desc    Create all award posts
 * @route   Create /api/awards
 * @access  Public
 */
export const createAwardPost = asyncHandler(
  async (req: Request, res: Response) => {
    const { title, description, category, images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400);
      throw new Error("At least one image is required");
    }

    // Debug logging
    console.log("Received category value:", category, typeof category);

    // Validate category exists and is type "award"
    if (!category || typeof category !== "string") {
      res.status(400);
      throw new Error("Category is required and must be a string");
    }
    // Try to find by ObjectId first, if that fails, try by name
    let categoryDoc;
    let categoryId = category; // Use a separate variable for the actual ID

    try {
      // First attempt: find by ObjectId
      categoryDoc = await CategoryModel.findOne({
        _id: category,
        type: "award",
      });
    } catch (error) {
      // If ObjectId cast fails, category might be a name instead of ID
      console.log("ObjectId cast failed, trying to find by name:", category);
    }
    // If not found by ID, try to find by name
    if (!categoryDoc) {
      categoryDoc = await CategoryModel.findOne({
        name: category,
        type: "award",
      });

      if (categoryDoc) {
        console.log("Found category by name, using ID:", categoryDoc._id);
        // Update the categoryId variable to use the correct ObjectId
        categoryId = categoryDoc._id.toString();
      }
    }
    if (!categoryDoc) {
      res.status(400);
      throw new Error(
        `Invalid award category: ${category}. Please ensure the category exists and is of type 'award'.`,
      );
    }
    const award = await AwardPostModel.create({
      title,
      description: description || undefined,
      category: categoryId,
      images,
    });
    await award.populate("category");

    res.status(201).json({
      success: true,
      message: "Award Info created successfully",
      data: award,
    });
  },
);

/**
 * Upload single award
 * @route POST /api/awards/upload
 * @access Private (Admin only)
 */
export const uploadAward = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  if (req.file.size === 0) {
    res.status(400);
    throw new Error("Uploaded file is empty");
  }

  const { alt, title, category, description } = req.body;

  if (!title || typeof title !== "string") {
    res.status(400);
    throw new Error("Title is required and must be a string");
  }

  if (!category || typeof category !== "string") {
    res.status(400);
    throw new Error("Category is required and must be a string");
  }

  let categoryDoc;
  if (Types.ObjectId.isValid(category)) {
    categoryDoc = await CategoryModel.findOne({ _id: category, type: "award" });
  }
  if (!categoryDoc) {
    categoryDoc = await CategoryModel.findOne({
      name: category,
      type: "award",
    });
  }
  if (!categoryDoc) {
    res.status(400);
    throw new Error(`Invalid award category: ${category}.`);
  }

  // Upload to Cloudinary — auto-resize happens here
  let uploadResult: any;
  try {
    uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "prapti-foundation-awards",
            resource_type: "image",
            transformation: [
              { width: 1200, height: 800, crop: "fill", gravity: "auto" }, // ← auto-resize
              { quality: "auto" },
              { format: "auto" },
            ],
          },
          (error, result) => {
            if (error) {
              logger.error("Cloudinary upload_stream error:", error);
              reject(error);
            } else {
              resolve(result);
            }
          },
        )
        .end(req.file!.buffer);
    });
  } catch (error: any) {
    res.status(502);
    throw new Error(`Image upload failed: ${error.message}`);
  }

  // Save to DB — wrapped so we can clean up Cloudinary on failure
  let award;
  try {
    award = await AwardPostModel.create({
      images: [
        {
          src: uploadResult.secure_url,
          alt: alt || title,
          cloudinaryPublicId: uploadResult.public_id,
        },
      ],
      title,
      category: categoryDoc._id,
      description: description || undefined,
    });
  } catch (error: any) {
    // Orphan prevention: delete the uploaded image if DB write fails
    await cloudinary.uploader.destroy(uploadResult.public_id).catch(() => {});
    logger.error("Award DB create failed:", error);
    res.status(400);
    throw new Error(error.message);
  }

  await award.populate("category");

  res.status(201).json({
    success: true,
    message: "Award uploaded successfully",
    data: { award, imagesCount: 1 },
  });
});

/**
 * Upload multiple awards to Cloudinary and save to database
 * @route POST /api/awards/upload-multiple
 * @access Private (Admin only)
 */
export const uploadMultipleAwards = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate files
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400);
      throw new Error("No files uploaded");
    }

    const files = req.files as Express.Multer.File[];
    const { title, category, description, altTexts } = req.body;

    // Validate required fields
    if (!title || typeof title !== "string") {
      res.status(400);
      throw new Error("Title is required and must be a string");
    }

    if (!category || typeof category !== "string") {
      res.status(400);
      throw new Error("Category is required and must be a string");
    }

    // Find category - handle both ObjectId and name
    let categoryDoc;

    // Try ObjectId first
    if (mongoose.Types.ObjectId.isValid(category)) {
      categoryDoc = await CategoryModel.findOne({
        _id: category,
        type: "award",
      });
    }

    // If not found, try by name
    if (!categoryDoc) {
      categoryDoc = await CategoryModel.findOne({
        name: category,
        type: "award",
      });
    }

    if (!categoryDoc) {
      res.status(400);
      throw new Error(
        `Invalid award category: ${category}. Ensure the category exists and is type 'award'.`,
      );
    }

    // Parse altTexts
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

    // Upload to Cloudinary
    const uploadPromises = files.map((file, index) => {
      return new Promise<{
        src: string;
        alt: string;
        cloudinaryPublicId: string;
      }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "prapti-foundation-awards",
            resource_type: "image",
            transformation: [
              { width: 1200, height: 800, crop: "fill" },
              { quality: "auto" },
              { format: "auto" },
              { gravity: "auto" },
            ],
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              return reject(error);
            }
            if (!result) {
              return reject(new Error("Upload failed - no result returned"));
            }
            resolve({
              src: result.secure_url,
              alt: altTextsArray[index] || title,
              cloudinaryPublicId: result.public_id,
            });
          },
        );

        uploadStream.end(file.buffer);
      });
    });

    let uploadedImages;
    try {
      uploadedImages = await Promise.all(uploadPromises);
    } catch (error) {
      console.error("Failed to upload images:", error);
      res.status(500);
      throw new Error(
        `Image upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }

    // Create award
    let award;
    try {
      award = await AwardPostModel.create({
        images: uploadedImages,
        title,
        category: categoryDoc._id,
        description: description || undefined,
      });
    } catch (error: any) {
      // Clean up all uploaded images on DB failure
      await Promise.allSettled(
        uploadedImages.map((img) =>
          cloudinary.uploader.destroy(img.cloudinaryPublicId),
        ),
      );
      logger.error("Award DB create failed:", error);
      res.status(400);
      throw new Error(error.message);
    }

    await award.populate("category", "name type");

    res.status(201).json({
      success: true,
      message: "Awards uploaded successfully",
      data: {
        award,
        imagesCount: uploadedImages.length,
      },
    });
  },
);

/**
 * @desc    GetBy all award posts
 * @route   GET /api/awards/:id
 * @access  Public
 */
export const getByIdAwardPost = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Award ID is required",
        });
        return;
      }

      const award = await AwardPostModel.findById(id).populate(
        "category",
        "name type",
      );

      if (!award) {
        res.status(404).json({
          success: false,
          message: "award post not found",
        });
        return;
      }

      res.status(200).json(award);
    } catch (error: any) {
      logger.error("Error fetching award post:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching award post",
        error: error.message,
      });
    }
  },
);

/**
 * @desc    Update award post with image management
 * @route   PATCH /api/awards/update/:id
 * @access  Private (Admin only)
 */
export const updateAwardPost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { title, description, category, imageAction, imageIndex, imageAlt } =
      req.body;

    // Validate ID format
    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid award ID format");
    }

    const award = await AwardPostModel.findById(id);
    if (!award) {
      res.status(404);
      throw new Error("Award post not found");
    }

    // Handle image operations
    if (imageAction) {
      const parsedIndex =
        imageIndex !== undefined ? parseInt(imageIndex, 10) : NaN;

      switch (imageAction) {
        case "add": {
          if (!req.file) {
            res.status(400);
            throw new Error("No file uploaded for image addition");
          }

          if (award.images.length >= 10) {
            res.status(400);
            throw new Error("Maximum 10 images allowed per award");
          }

          try {
            const uploadResult = await new Promise<any>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  folder: "prapti-foundation-awards",
                  resource_type: "image",
                  transformation: [
                    { width: 1200, height: 800, crop: "fill" },
                    { quality: "auto" },
                    { format: "auto" },
                    { gravity: "auto" },
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

            award.images.push({
              src: uploadResult.secure_url,
              alt: imageAlt || award.title,
              cloudinaryPublicId: uploadResult.public_id,
            });

            logger.info(
              `Image added to award ${id}: ${uploadResult.public_id}`,
            );
          } catch (error: any) {
            res.status(500);
            throw new Error(`Failed to upload image: ${error.message}`);
          }
          break;
        }

        case "delete": {
          // Validate index
          if (isNaN(parsedIndex)) {
            res.status(400);
            throw new Error("imageIndex is required for delete action");
          }

          if (parsedIndex < 0 || parsedIndex >= award.images.length) {
            res.status(400);
            throw new Error(
              `Invalid image index: ${parsedIndex}. Valid range: 0-${
                award.images.length - 1
              }`,
            );
          }

          // Check if this is the last image - only block if no new images being added
          // Allow deletion if there will be at least one image remaining
          if (award.images.length === 1) {
            res.status(400);
            throw new Error(
              "Cannot delete the last image. Upload a new image first or keep at least one image.",
            );
          }

          const imageToDelete = award.images[parsedIndex];

          if (!imageToDelete) {
            res.status(400);
            throw new Error(`No image found at index ${parsedIndex}`);
          }

          // Delete from Cloudinary (non-blocking - continue even if fails)
          if (imageToDelete.cloudinaryPublicId) {
            try {
              await cloudinary.uploader.destroy(
                imageToDelete.cloudinaryPublicId,
              );
              logger.info(
                `Deleted from Cloudinary: ${imageToDelete.cloudinaryPublicId}`,
              );
            } catch (cloudinaryError: any) {
              // Log but don't fail the request - image might already be deleted
              logger.warn(
                `Cloudinary deletion warning for ${imageToDelete.cloudinaryPublicId}: ${cloudinaryError.message}`,
              );
            }
          }

          // Remove from array
          award.images.splice(parsedIndex, 1);
          logger.info(`Image at index ${parsedIndex} removed from award ${id}`);
          break;
        }

        case "updateAlt": {
          if (isNaN(parsedIndex)) {
            res.status(400);
            throw new Error("imageIndex is required for updateAlt action");
          }

          if (parsedIndex < 0 || parsedIndex >= award.images.length) {
            res.status(400);
            throw new Error(
              `Invalid image index: ${parsedIndex}. Valid range: 0-${
                award.images.length - 1
              }`,
            );
          }

          if (!imageAlt || typeof imageAlt !== "string") {
            res.status(400);
            throw new Error("imageAlt text is required and must be a string");
          }

          award.images[parsedIndex].alt = imageAlt.trim();
          logger.info(`Alt text updated for image at index ${parsedIndex}`);
          break;
        }

        default:
          res.status(400);
          throw new Error(
            `Invalid imageAction: "${imageAction}". Use: add, delete, or updateAlt`,
          );
      }
    }

    // Handle category update
    if (category !== undefined && category !== null && category !== "") {
      if (typeof category !== "string") {
        res.status(400);
        throw new Error("Category must be a string");
      }

      let categoryDoc = null;

      // First try to find by ObjectId
      if (Types.ObjectId.isValid(category)) {
        categoryDoc = await CategoryModel.findOne({
          _id: category,
          type: "award",
        });
      }

      // If not found by ID, try by name
      if (!categoryDoc) {
        categoryDoc = await CategoryModel.findOne({
          name: { $regex: new RegExp(`^${category}$`, "i") },
          type: "award",
        });
      }

      if (!categoryDoc) {
        res.status(400);
        throw new Error(
          `Invalid award category: "${category}". Please select a valid category.`,
        );
      }

      award.category = categoryDoc._id as unknown as Types.ObjectId;
    }

    // Update text fields (only if provided)
    if (title !== undefined && title !== null) {
      const trimmedTitle = String(title).trim();
      if (trimmedTitle.length === 0) {
        res.status(400);
        throw new Error("Title cannot be empty");
      }
      award.title = trimmedTitle;
    }

    if (description !== undefined && description !== null) {
      award.description = String(description).trim();
    }

    // Save changes
    try {
      const updatedAward = await award.save();
      await updatedAward.populate("category", "name type");

      logger.info(`Award updated successfully: ${updatedAward._id}`);

      res.status(200).json({
        success: true,
        message: "Award updated successfully",
        data: updatedAward,
      });
    } catch (error: any) {
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message,
        );
        res.status(400);
        throw new Error(`Validation error: ${validationErrors.join(", ")}`);
      }
      logger.error(`Failed to save award: ${error.message}`);
      throw error;
    }
  },
);

/**
 * @desc    Delete all award posts
 * @route   DELETE /api/awards/del/:id
 * @access  Private (Admin only)
 */
export const delAwardPost = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid award ID format");
    }

    const award = await AwardPostModel.findById(id);
    if (!award) {
      res.status(404);
      throw new Error("Award post not found");
    }

    // Delete all images from Cloudinary
    const deletePromises = award.images.map(async (image) => {
      try {
        if (image.cloudinaryPublicId) {
          const deleteResult = await cloudinary.uploader.destroy(
            image.cloudinaryPublicId,
          );
          logger.info(
            `Deleted image from Cloudinary: ${image.cloudinaryPublicId}, result: ${deleteResult.result}`,
          );
        }
      } catch (cloudinaryError) {
        // Log error but don't fail the deletion
        logger.error(
          `Failed to delete image from Cloudinary: ${cloudinaryError}`,
        );
      }
    });

    // Wait for all Cloudinary deletions to complete
    await Promise.allSettled(deletePromises);

    // Delete from database
    await AwardPostModel.findByIdAndDelete(id);

    logger.info(`Award post deleted: ${award.title}`);

    res.status(200).json({
      success: true,
      message: "Award post deleted successfully",
    });
  },
);
