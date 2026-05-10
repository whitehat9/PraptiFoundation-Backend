import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICopyImage {
  src: string;
  alt: string;
  cloudinaryPublicId: string;
}

export interface ICopyPhoto extends Document {
  images: ICopyImage[];
  title: string;
  category: Types.ObjectId;
  date: Date;
  location?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const copyImageSchema = new Schema<ICopyImage>({
  src: { type: String, required: true, trim: true },
  alt: { type: String, required: true, trim: true, maxlength: 200 },
  cloudinaryPublicId: { type: String, required: true, trim: true },
});

const copyPhotoSchema: Schema<ICopyPhoto> = new Schema(
  {
    images: {
      type: [copyImageSchema],
      required: true,
      validate: {
        validator: (arr: ICopyImage[]) => arr.length > 0 && arr.length <= 10,
        message: "Must have between 1 and 10 images",
      },
    },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      validate: {
        validator: async function (value: Types.ObjectId) {
          const cat = await mongoose
            .model("Category")
            .findOne({ _id: value, type: "photo" });
          return !!cat;
        },
        message: "Invalid photo category",
      },
    },
    date: { type: Date, default: Date.now },
    location: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Guard: block delete if referenced by any CopyAward
async function guardCopyPhotoDelete(this: any, next: (err?: Error) => void) {
  try {
    const doc = await this.model.findOne(this.getQuery()).select("_id").lean();
    if (!doc) return next();

    const CopyAwardModel = mongoose.model("copyAwardPost");
    const refCount = await CopyAwardModel.countDocuments({ photos: doc._id });

    if (refCount > 0) {
      const err: any = new Error(
        `Photo is referenced by ${refCount} award(s). Remove from awards first.`,
      );
      err.code = "PHOTO_IN_USE";
      err.statusCode = 409;
      return next(err);
    }
    next();
  } catch (e: any) {
    next(e);
  }
}

copyPhotoSchema.pre("findOneAndDelete", guardCopyPhotoDelete);
copyPhotoSchema.pre(
  "deleteOne",
  { document: false, query: true },
  guardCopyPhotoDelete,
);

copyPhotoSchema.index({ category: 1 });
copyPhotoSchema.index({ createdAt: -1 });

const CopyPhotoModel = mongoose.model<ICopyPhoto>("copyPhoto", copyPhotoSchema);
export default CopyPhotoModel;
