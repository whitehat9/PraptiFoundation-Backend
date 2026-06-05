import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import CategoryModel from "../models/categoryModel";
import PhotoModel from "../models/photoModel";
import VideoModel from "../models/VideoModel";
import BlogPostModel from "../models/blogModel";
import AwardPostModel from "../models/awardModel";
import RescuePostModel from "../models/rescueModel";
import logger from "../utils/logger";
import { getUserRole } from "../constants/roles";

/**
 * @desc    Get categories by type
 * @route   GET /api/categories/:type
 * @access  Public
 */
export const getCategoriesByType = asyncHandler(
  async (req: Request, res: Response) => {
    const { type } = req.params;

    if (!["photo", "video", "blogs", "award", "rescue"].includes(type)) {
      res.status(400);
      throw new Error("Invalid category type");
    }

    const categories = await CategoryModel.find({ type }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: categories,
    });
  },
);

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Private/Admin
 */
export const getAllCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const categories = await CategoryModel.find().sort({ type: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: categories,
    });
  },
);

/**
 * @desc    Create category
 * @route   POST /api/categories
 * @access  Private/Admin
 */
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, type } = req.body;

    const category = await CategoryModel.create({ name, type });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  },
);

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Private/Admin
 */
export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name } = req.body;

    const category = await CategoryModel.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true },
    );

    if (!category) {
      res.status(404);
      throw new Error("Category not found");
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  },
);

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private/Admin
 */
export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await CategoryModel.findById(req.params.id);

    if (!category) {
      res.status(404);
      throw new Error("Category not found");
    }

    // Check if category is being used
    const isUsed = await Promise.all([
      PhotoModel.findOne({ category: req.params.id }),
      VideoModel.findOne({ category: req.params.id }),
      BlogPostModel.findOne({ category: req.params.id }),
      AwardPostModel.findOne({ category: req.params.id }),
      RescuePostModel.findOne({ category: req.params.id }),
    ]);

    if (isUsed.some((result) => result)) {
      res.status(400);
      throw new Error("Cannot delete category that is currently in use");
    }

    // req.user is set by the router-level `protect` middleware.
    const actor = req.user;
    const actorName = actor?.name ?? "unknown";
    const actorRole = actor ? getUserRole(actor) : "unknown";
    const actorId = actor?._id?.toString() ?? "unknown";

    await CategoryModel.findByIdAndDelete(req.params.id);

    logger.info(
      `Category deleted: "${category.name}" (id: ${req.params.id}) by ${actorRole} ${actorName} (${actor?.email ?? "unknown"}, id: ${actorId})`,
    );

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  },
);
