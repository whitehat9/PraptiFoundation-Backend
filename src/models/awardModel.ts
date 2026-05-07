import mongoose, { Document, Schema } from "mongoose";
import { IImage, imageSchema } from "./photoModel";

export interface IAwardPost extends Document {
  title: string;
  description: string;
  category: mongoose.Types.ObjectId;
  images: IImage[];
  createdAt: Date;
  updatedAt: Date;
}

const awardPostSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [200, "Title cannot be more than 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Please add content"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Please add a category"],
    },
    images: {
      type: [imageSchema],
      required: [true, "At least one image is required"],
      validate: {
        validator: function (images: IImage[]) {
          return images && images.length > 0 && images.length <= 10; // Max 10 images
        },
        message: "Must have between 1 and 10 images",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
awardPostSchema.index({ category: 1 });
awardPostSchema.index({ createdAt: -1 });

const AwardPostModel = mongoose.model<IAwardPost>("awardPost", awardPostSchema);
export default AwardPostModel;
