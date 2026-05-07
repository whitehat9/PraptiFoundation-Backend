import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import PhotoModel, { IPhoto } from "../models/photoModel";
import CategoryModel from "../models/categoryModel";
import cloudinary from "../config/cloudinaryConfig";
import { Types } from "mongoose";

/**
 * Get all photos with pagination and filtering
 * @route GET /api/photos
 * @access Public
 */
export const getPhotos = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 12,
    category,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build filter object
  const filter: any = { isActive: true };

  if (category && category !== "all") {
    // Try to resolve category name to ObjectId
    const categoryDoc = await CategoryModel.findOne({
      name: category,
      type: "photo",
    });

    if (!categoryDoc) {
      res.status(400);
      throw new Error(`Invalid category: ${category}`);
    }

    filter.category = categoryDoc._id;
  }

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { "images.alt": { $regex: search, $options: "i" } },
    ];
  }

  // Build sort object
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const [photos, total] = await Promise.all([
    PhotoModel.find(filter)
      .populate("category", "name type")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    PhotoModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    data: {
      photos,
      pagination: {
        current: pageNum,
        pages: totalPages,
        total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    },
  });
});

/**
 * Get single photo by ID
 * @route GET /api/photos/:id
 * @access Public
 */
export const getPhoto = asyncHandler(async (req: Request, res: Response) => {
  const photo = await PhotoModel.findById(req.params.id).populate(
    "category",
    "name type",
  );

  if (!photo || !photo.isActive) {
    res.status(404);
    throw new Error("Photo not found");
  }

  res.status(200).json({
    success: true,
    data: photo,
  });
});

/**
 * Create photo with existing image URLs
 * @route POST /api/photos
 * @access Private (Admin only)
 */
export const createPhoto = asyncHandler(async (req: Request, res: Response) => {
  const { images, title, category, date, location, description } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    res.status(400);
    throw new Error("At least one image is required");
  }

  // Debug logging
  console.log("Received category value:", category, typeof category);

  // Validate category exists and is type "photo"
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
      type: "photo",
    });
  } catch (error) {
    // If ObjectId cast fails, category might be a name instead of ID
    console.log("ObjectId cast failed, trying to find by name:", category);
  }

  // If not found by ID, try to find by name
  if (!categoryDoc) {
    categoryDoc = await CategoryModel.findOne({
      name: category,
      type: "photo",
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
      `Invalid photo category: ${category}. Please ensure the category exists and is of type 'photo'.`,
    );
  }

  const photo = await PhotoModel.create({
    images,
    title,
    category: categoryId, // Use the resolved category ID
    date: date ? new Date(date) : new Date(),
    location: location || undefined,
    description: description || undefined,
  });

  await photo.populate("category", "name type");

  res.status(201).json({
    success: true,
    message: "Photo created successfully",
    data: photo,
  });
});

/**
 * Upload single photo
 * @route POST /api/photos/upload
 * @access Private (Admin only)
 */
export const uploadPhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  const { alt, title, category, date, location, description } = req.body;

  // Debug logging
  console.log("Received category value:", category, typeof category);

  // Validate category exists and is type "photo"
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
      type: "photo",
    });
  } catch (error) {
    // If ObjectId cast fails, category might be a name instead of ID
    console.log("ObjectId cast failed, trying to find by name:", category);
  }

  // If not found by ID, try to find by name
  if (!categoryDoc) {
    categoryDoc = await CategoryModel.findOne({
      name: category,
      type: "photo",
    });

    if (categoryDoc) {
      console.log("Found category by name, using ID:", categoryDoc._id);
      // Use the correct ObjectId for database insertion
      categoryId = categoryDoc._id.toString();
    }
  }

  if (!categoryDoc) {
    res.status(400);
    throw new Error(
      `Invalid photo category: ${category}. Please ensure the category exists and is of type 'photo'.`,
    );
  }

  // Upload to Cloudinary
  const cloudinaryResult = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "prapti-foundation-images",
          resource_type: "image",
          transformation: [
            { width: 1200, height: 800, crop: "fill" },
            { quality: "auto" },
            { format: "auto" },
            { gravity: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      )
      .end(req.file!.buffer);
  });

  const uploadResult = cloudinaryResult as any;

  // Create photo record with single image
  const photo = await PhotoModel.create({
    images: [
      {
        src: uploadResult.secure_url,
        alt: alt || title,
        cloudinaryPublicId: uploadResult.public_id,
      },
    ],
    title,
    category: categoryId, // Use the resolved category ID
    date: date ? new Date(date) : new Date(),
    location: location || undefined,
    description: description || undefined,
  });

  await photo.populate("category", "name type");

  res.status(201).json({
    success: true,
    message: "Photo uploaded successfully",
    data: {
      photo,
      imagesCount: 1,
    },
  });
});

/**
 * Upload multiple photos to Cloudinary and save to database
 * @route POST /api/photos/upload-multiple
 * @access Private (Admin only)
 */
export const uploadMultiplePhotos = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400);
      throw new Error("No files uploaded");
    }

    const files = req.files as Express.Multer.File[];
    const { title, category, date, location, description, altTexts } = req.body;

    // Debug logging
    console.log("Received category value:", category, typeof category);

    // Validate category exists and is type "photo"
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
        type: "photo",
      });
    } catch (error) {
      // If ObjectId cast fails, category might be a name instead of ID
      console.log("ObjectId cast failed, trying to find by name:", category);
    }

    // If not found by ID, try to find by name
    if (!categoryDoc) {
      categoryDoc = await CategoryModel.findOne({
        name: category,
        type: "photo",
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
        `Invalid photo category: ${category}. Please ensure the category exists and is of type 'photo'.`,
      );
    }

    // Parse altTexts if it's a string
    let altTextsArray: string[] = [];
    if (typeof altTexts === "string") {
      try {
        altTextsArray = JSON.parse(altTexts);
      } catch (error) {
        altTextsArray = [altTexts];
      }
    } else if (Array.isArray(altTexts)) {
      altTextsArray = altTexts;
    }

    // Upload all files to Cloudinary
    const uploadPromises = files.map((file, index) => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: "prapti-foundation-images",
              resource_type: "image",
              transformation: [
                { width: 1200, height: 800, crop: "limit" },
                { quality: "auto" },
                { format: "auto" },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else
                resolve({
                  src: result!.secure_url,
                  alt: altTextsArray[index] || title,
                  cloudinaryPublicId: result!.public_id,
                });
            },
          )
          .end(file.buffer);
      });
    });

    const uploadedImages = await Promise.all(uploadPromises);

    // Create photo record with multiple images
    const photo = await PhotoModel.create({
      images: uploadedImages,
      title,
      category: categoryId, // Use the resolved category ID
      date: date ? new Date(date) : new Date(),
      location: location || undefined,
      description: description || undefined,
    });

    await photo.populate("category", "name type");

    res.status(201).json({
      success: true,
      message: "Photos uploaded successfully",
      data: {
        photo,
        imagesCount: uploadedImages.length,
      },
    });
  },
);

/**
 * Update photo
 * @route PATCH /api/photos/:id
 * @access Private (Admin only)
 */
export const updatePhoto = asyncHandler(async (req: Request, res: Response) => {
  const photo = await PhotoModel.findById(req.params.id);

  if (!photo) {
    res.status(404);
    throw new Error("Photo not found");
  }

  if (!req.body) {
    res.status(400);
    throw new Error("Request body is required");
  }

  const { images, title, category, date, location, description, isActive } =
    req.body;

  // Validate and resolve category if it's being updated
  if (category !== undefined) {
    // Debug logging
    console.log("Received category value:", category, typeof category);

    if (!category || typeof category !== "string") {
      res.status(400);
      throw new Error("Category must be a string");
    }

    // Try to find by ObjectId first, if that fails, try by name
    let categoryDoc;
    let categoryId = category;

    try {
      // First attempt: find by ObjectId
      categoryDoc = await CategoryModel.findOne({
        _id: category,
        type: "photo",
      });
    } catch (error) {
      // If ObjectId cast fails, category might be a name instead of ID
      console.log("ObjectId cast failed, trying to find by name:", category);
    }

    // If not found by ID, try to find by name
    if (!categoryDoc) {
      categoryDoc = await CategoryModel.findOne({
        name: category,
        type: "photo",
      });

      if (categoryDoc) {
        console.log("Found category by name, using ID:", categoryDoc._id);
        categoryId = categoryDoc._id.toString();
      }
    }

    if (!categoryDoc) {
      res.status(400);
      throw new Error(
        `Invalid photo category: ${category}. Please ensure the category exists and is of type 'photo'.`,
      );
    }

    // Update with resolved category ID
    photo.category = new Types.ObjectId(categoryDoc._id);
  }

  // Update other fields
  if (images !== undefined) photo.images = images;
  if (title !== undefined) photo.title = title;
  if (date !== undefined) photo.date = new Date(date);
  if (location !== undefined) photo.location = location || undefined;
  if (description !== undefined) photo.description = description || undefined;
  if (isActive !== undefined) photo.isActive = isActive;

  const updatedPhoto = await photo.save();
  await updatedPhoto.populate("category", "name type");

  res.status(200).json({
    success: true,
    message: "Photo updated successfully",
    data: updatedPhoto,
  });
});

/**
 * Update photo with file upload and image management
 * @route PATCH /api/photos/:id/upload
 * @access Private (Admin only)
 */
export const updatePhotoWithFile = asyncHandler(
  async (req: Request, res: Response) => {
    const photo = await PhotoModel.findById(req.params.id);

    if (!photo) {
      res.status(404);
      throw new Error("Photo not found");
    }

    const {
      title,
      category,
      date,
      location,
      description,
      isActive,
      alt,
      imageAction,
      imageIndex,
      imageAlt,
    } = req.body;

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

          if (photo.images.length >= 20) {
            res.status(400);
            throw new Error("Maximum 20 images allowed per photo record");
          }

          try {
            const uploadResult = await new Promise<any>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  folder: "prapti-foundation-images",
                  resource_type: "image",
                  transformation: [
                    { width: 1200, height: 800, crop: "fill" },
                    { quality: "auto" },
                    { format: "auto" },
                  ],
                },
                (error, result) => {
                  if (error) {
                    console.error(`Cloudinary upload failed: ${error.message}`);
                    reject(error);
                  } else {
                    resolve(result);
                  }
                },
              );
              uploadStream.end(req.file!.buffer);
            });

            photo.images.push({
              src: uploadResult.secure_url,
              alt: imageAlt || alt || photo.title,
              cloudinaryPublicId: uploadResult.public_id,
            });

            console.log(
              `Image added to photo ${req.params.id}: ${uploadResult.public_id}`,
            );
          } catch (error: any) {
            res.status(500);
            throw new Error(`Failed to upload image: ${error.message}`);
          }
          break;
        }

        case "delete": {
          if (isNaN(parsedIndex)) {
            res.status(400);
            throw new Error("imageIndex is required for delete action");
          }

          if (parsedIndex < 0 || parsedIndex >= photo.images.length) {
            res.status(400);
            throw new Error(
              `Invalid image index: ${parsedIndex}. Valid range: 0-${
                photo.images.length - 1
              }`,
            );
          }

          if (photo.images.length === 1) {
            res.status(400);
            throw new Error(
              "Cannot delete the last image. Upload a new image first or keep at least one image.",
            );
          }

          const imageToDelete = photo.images[parsedIndex];

          if (!imageToDelete) {
            res.status(400);
            throw new Error(`No image found at index ${parsedIndex}`);
          }

          // Delete from Cloudinary (non-blocking)
          if (imageToDelete.cloudinaryPublicId) {
            try {
              await cloudinary.uploader.destroy(
                imageToDelete.cloudinaryPublicId,
              );
              console.log(
                `Deleted from Cloudinary: ${imageToDelete.cloudinaryPublicId}`,
              );
            } catch (cloudinaryError: any) {
              console.warn(
                `Cloudinary deletion warning for ${imageToDelete.cloudinaryPublicId}: ${cloudinaryError.message}`,
              );
            }
          }

          photo.images.splice(parsedIndex, 1);
          console.log(
            `Image at index ${parsedIndex} removed from photo ${req.params.id}`,
          );
          break;
        }

        case "updateAlt": {
          if (isNaN(parsedIndex)) {
            res.status(400);
            throw new Error("imageIndex is required for updateAlt action");
          }

          if (parsedIndex < 0 || parsedIndex >= photo.images.length) {
            res.status(400);
            throw new Error(
              `Invalid image index: ${parsedIndex}. Valid range: 0-${
                photo.images.length - 1
              }`,
            );
          }

          if (!imageAlt || typeof imageAlt !== "string") {
            res.status(400);
            throw new Error("imageAlt text is required and must be a string");
          }

          photo.images[parsedIndex].alt = imageAlt.trim();
          console.log(`Alt text updated for image at index ${parsedIndex}`);
          break;
        }

        default:
          res.status(400);
          throw new Error(
            `Invalid imageAction: "${imageAction}". Use: add, delete, or updateAlt`,
          );
      }
    } else if (req.file) {
      // Legacy behavior: add image without explicit action
      try {
        const cloudinaryResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "prapti-foundation-images",
                resource_type: "image",
                transformation: [
                  { width: 1200, height: 800, crop: "fill" },
                  { quality: "auto" },
                  { format: "auto" },
                ],
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              },
            )
            .end(req.file!.buffer);
        });

        const uploadResult = cloudinaryResult as any;

        photo.images.push({
          src: uploadResult.secure_url,
          alt: alt || photo.title,
          cloudinaryPublicId: uploadResult.public_id,
        });
      } catch (error) {
        console.error("Image upload failed:", error);
        res.status(500);
        throw new Error("Failed to upload image");
      }
    }

    // Validate and resolve category if provided
    if (category !== undefined) {
      if (!category || typeof category !== "string") {
        res.status(400);
        throw new Error("Category must be a string");
      }

      let categoryDoc;

      try {
        categoryDoc = await CategoryModel.findOne({
          _id: category,
          type: "photo",
        });
      } catch (error) {
        // ObjectId cast failed
      }

      if (!categoryDoc) {
        categoryDoc = await CategoryModel.findOne({
          name: category,
          type: "photo",
        });
      }

      if (!categoryDoc) {
        res.status(400);
        throw new Error(
          `Invalid photo category: ${category}. Please ensure the category exists and is of type 'photo'.`,
        );
      }

      photo.category = new Types.ObjectId(categoryDoc._id);
    }

    // Update other fields
    if (title !== undefined) photo.title = title;
    if (date !== undefined) photo.date = new Date(date);
    if (location !== undefined) photo.location = location || undefined;
    if (description !== undefined) photo.description = description || undefined;
    if (isActive !== undefined)
      photo.isActive = isActive === "true" || isActive === true;

    const updatedPhoto = await photo.save();
    await updatedPhoto.populate("category", "name type");

    res.status(200).json({
      success: true,
      message: "Photo updated successfully",
      data: updatedPhoto,
    });
  },
);
/**
 * Delete photo
 * @route DELETE /api/photos/:id
 * @access Private (Admin only)
 */
export const deletePhoto = asyncHandler(async (req: Request, res: Response) => {
  const photo = await PhotoModel.findById(req.params.id);

  if (!photo) {
    res.status(404);
    throw new Error("Photo not found");
  }

  // Delete all images from Cloudinary
  const deletePromises = photo.images.map((image) =>
    cloudinary.uploader.destroy(image.cloudinaryPublicId),
  );

  await Promise.allSettled(deletePromises);

  // Delete from database
  await PhotoModel.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Photo deleted successfully",
  });
});

/**
 * Get photos by category (Public)
 * @route GET /api/photos/category/:category
 * @access Public
 */
export const getPhotosByCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { category } = req.params;
    const { limit = 12 } = req.query;

    const limitNum = parseInt(limit as string, 10);

    const photos = await PhotoModel.find({
      category,
      isActive: true,
    })
      .populate("category", "name type")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    const total = await PhotoModel.countDocuments({
      category,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        photos,
        pagination: {
          current: 1,
          pages: Math.ceil(total / limitNum),
          total,
          hasNext: total > limitNum,
          hasPrev: false,
        },
      },
    });
  },
);

/**
 * Search photos (Public)
 * @route GET /api/photos/search
 * @access Public
 */
export const searchPhotos = asyncHandler(
  async (req: Request, res: Response) => {
    const { search, limit = 12 } = req.query;

    if (!search) {
      res.status(400);
      throw new Error("Search query is required");
    }

    const limitNum = parseInt(limit as string, 10);

    const filter = {
      isActive: true,
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { "images.alt": { $regex: search, $options: "i" } },
      ],
    };

    const photos = await PhotoModel.find(filter)
      .populate("category", "name type")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    const total = await PhotoModel.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        photos,
        pagination: {
          current: 1,
          pages: Math.ceil(total / limitNum),
          total,
          hasNext: total > limitNum,
          hasPrev: false,
        },
      },
    });
  },
);
