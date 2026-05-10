import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICopyAwardPost extends Document {
  title: string;
  description: string;
  category: Types.ObjectId;
  photos: Types.ObjectId[];
  videos: Types.ObjectId[];
  awardedDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_PHOTOS = 20;
const MAX_VIDEOS = 10;

const copyAwardSchema: Schema<ICopyAwardPost> = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      validate: {
        validator: async function (value: Types.ObjectId) {
          const cat = await mongoose
            .model("Category")
            .findOne({ _id: value, type: "award" });
          return !!cat;
        },
        message: "Invalid award category",
      },
    },
    photos: {
      type: [{ type: Schema.Types.ObjectId, ref: "copyPhoto" }],
      default: [],
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length <= MAX_PHOTOS,
        message: `Max ${MAX_PHOTOS} photos`,
      },
    },
    videos: {
      type: [{ type: Schema.Types.ObjectId, ref: "Video" }],
      default: [],
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length <= MAX_VIDEOS,
        message: `Max ${MAX_VIDEOS} videos`,
      },
    },
    awardedDate: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

copyAwardSchema.index({ category: 1, createdAt: -1 });
copyAwardSchema.index({ photos: 1 });
copyAwardSchema.index({ videos: 1 });

const CopyAwardModel = mongoose.model<ICopyAwardPost>(
  "copyAwardPost",
  copyAwardSchema,
);
export default CopyAwardModel;
