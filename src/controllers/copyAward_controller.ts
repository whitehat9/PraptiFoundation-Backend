import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { Types } from "mongoose";
import CopyAwardModel from "../models/copyAwardModel";
import CopyPhotoModel from "../models/copyPhotoModel";
import VideoModel from "../models/VideoModel";
import CategoryModel from "../models/categoryModel";

const resolveAwardCategory = async (category: string) => {
  if (!category || typeof category !== "string") {
    throw new Error("Category is required");
  }
  let doc = Types.ObjectId.isValid(category)
    ? await CategoryModel.findOne({ _id: category, type: "award" })
    : null;
  if (!doc) {
    doc = await CategoryModel.findOne({
      name: { $regex: new RegExp(`^${category}$`, "i") },
      type: "award",
    });
  }
  if (!doc) throw new Error(`Invalid award category: ${category}`);
  return doc;
};

const validateMediaRefs = async (
  photoIds: string[] = [],
  videoIds: string[] = [],
) => {
  const uniquePhotos = [...new Set(photoIds.filter(Boolean))];
  const uniqueVideos = [...new Set(videoIds.filter(Boolean))];

  if (uniquePhotos.some((id) => !Types.ObjectId.isValid(id))) {
    throw new Error("Invalid photo id in payload");
  }
  if (uniqueVideos.some((id) => !Types.ObjectId.isValid(id))) {
    throw new Error("Invalid video id in payload");
  }

  const [photoCount, videoCount] = await Promise.all([
    uniquePhotos.length
      ? CopyPhotoModel.countDocuments({ _id: { $in: uniquePhotos } })
      : 0,
    uniqueVideos.length
      ? VideoModel.countDocuments({ _id: { $in: uniqueVideos } })
      : 0,
  ]);

  if (photoCount !== uniquePhotos.length) {
    throw new Error("One or more photo references do not exist");
  }
  if (videoCount !== uniqueVideos.length) {
    throw new Error("One or more video references do not exist");
  }

  return {
    photos: uniquePhotos.map((id) => new Types.ObjectId(id)),
    videos: uniqueVideos.map((id) => new Types.ObjectId(id)),
  };
};

/**
 * @route GET /api/copy-awards
 */
export const getCopyAwards = asyncHandler(
  async (_req: Request, res: Response) => {
    const awards = await CopyAwardModel.find({ isActive: true })
      .populate("category", "name type")
      .populate({
        path: "photos",
        match: { isActive: true },
        select: "title images date location description",
      })
      .populate({
        path: "videos",
        match: { isActive: true },
        select: "title thumbnail videoUrl duration date description",
      })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: awards });
  },
);

/**
 * @route GET /api/copy-awards/:id
 */
export const getCopyAwardById = asyncHandler(
  async (req: Request, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Invalid award id");
    }

    const award = await CopyAwardModel.findById(req.params.id)
      .populate("category", "name type")
      .populate({ path: "photos", match: { isActive: true } })
      .populate({ path: "videos", match: { isActive: true } })
      .lean();

    if (!award) {
      res.status(404);
      throw new Error("Award not found");
    }
    res.status(200).json({ success: true, data: award });
  },
);

/**
 * @route POST /api/copy-awards
 */
export const createCopyAward = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      title,
      description,
      category,
      photos = [],
      videos = [],
      awardedDate,
    } = req.body;

    if (!title || !description) {
      res.status(400);
      throw new Error("title and description are required");
    }

    const categoryDoc = await resolveAwardCategory(category);
    const refs = await validateMediaRefs(photos, videos);

    const award = await CopyAwardModel.create({
      title,
      description,
      category: categoryDoc._id,
      photos: refs.photos,
      videos: refs.videos,
      awardedDate: awardedDate ? new Date(awardedDate) : undefined,
    });

    await award.populate([
      { path: "category", select: "name type" },
      { path: "photos", select: "title images" },
      { path: "videos", select: "title thumbnail" },
    ]);

    res.status(201).json({ success: true, data: award });
  },
);

/**
 * @route PATCH /api/copy-awards/:id
 */
export const updateCopyAward = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid award id");
    }

    const award = await CopyAwardModel.findById(id);
    if (!award) {
      res.status(404);
      throw new Error("Award not found");
    }

    const {
      title,
      description,
      category,
      photos,
      videos,
      awardedDate,
      isActive,
    } = req.body;

    if (title !== undefined) award.title = title;
    if (description !== undefined) award.description = description;
    if (isActive !== undefined) award.isActive = !!isActive;
    if (awardedDate !== undefined) award.awardedDate = new Date(awardedDate);

    if (category !== undefined) {
      const categoryDoc = await resolveAwardCategory(category);
      award.category = categoryDoc._id as unknown as Types.ObjectId;
    }

    if (photos !== undefined || videos !== undefined) {
      const refs = await validateMediaRefs(
        photos ?? award.photos.map((p) => p.toString()),
        videos ?? award.videos.map((v) => v.toString()),
      );
      if (photos !== undefined) award.photos = refs.photos;
      if (videos !== undefined) award.videos = refs.videos;
    }

    await award.save();
    await award.populate([
      { path: "category", select: "name type" },
      { path: "photos", select: "title images" },
      { path: "videos", select: "title thumbnail" },
    ]);

    res.status(200).json({ success: true, data: award });
  },
);

/**
 * @route DELETE /api/copy-awards/:id
 */
export const deleteCopyAward = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid award id");
    }

    const deleted = await CopyAwardModel.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404);
      throw new Error("Award not found");
    }

    // Photos/Videos remain — they're shared resources
    res.status(200).json({ success: true, message: "Award deleted" });
  },
);
