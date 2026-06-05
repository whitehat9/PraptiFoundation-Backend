import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
import { ROLES } from "../constants/roles";

dotenv.config();

const JWT_SECRET: Secret = process.env.JWT_SECRET || "";
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "30d";

export interface IEditor extends Document {
  name: string;
  email: string;
  password: string;
  role: typeof ROLES.EDITOR;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  matchPassword: (entered: string) => Promise<boolean>;
  getSignedJwtToken: () => string;
}

const editorSchema = new Schema<IEditor>(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: [ROLES.EDITOR],
      default: ROLES.EDITOR,
      immutable: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

editorSchema.pre<IEditor>("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error("Error hashing password"));
  }
});

editorSchema.methods.matchPassword = async function (
  entered: string,
): Promise<boolean> {
  return bcrypt.compare(entered, this.password);
};

editorSchema.methods.getSignedJwtToken = function (): string {
  const options: SignOptions = { expiresIn: TOKEN_EXPIRY };
  return jwt.sign({ id: this._id, role: ROLES.EDITOR }, JWT_SECRET, options);
};

editorSchema.index({ isActive: 1 });

const EditorModel = mongoose.model<IEditor>("Editor", editorSchema);
export default EditorModel;
