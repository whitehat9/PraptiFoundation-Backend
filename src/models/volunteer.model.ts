import mongoose, { Document, Schema } from "mongoose";

export type VolunteerStatus = "pending" | "approved" | "rejected";

export interface IVolunteer extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: number;
  address: string;
  district: string;
  state: string;
  pincode: number;
  availability: string;
  interests: string[];
  experience: string;
  reason: string;
  isRead: boolean;
  status: VolunteerStatus;
  rejectionReason?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  submittedAt: Date;
}

const VolunteerSchema = new Schema<IVolunteer>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: Number,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
    district: {
      type: String,
      required: [true, "District is required"],
      trim: true,
      maxlength: [50, "District cannot exceed 50 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [50, "State cannot exceed 50 characters"],
    },
    pincode: {
      type: Number,
      required: [true, "Pincode is required"],
      trim: true,
      maxlength: [7, "Pincode cannot exceed 7 characters"],
    },
    availability: {
      type: String,
      required: [true, "Availability is required"],
      enum: {
        values: ["weekdays", "weekends", "evenings", "flexible"],
        message:
          "Availability must be one of: weekdays, weekends, evenings, flexible",
      },
    },
    interests: {
      type: [String],
      required: [true, "At least one interest must be selected"],
      validate: {
        validator: function (arr: string[]) {
          return arr.length > 0;
        },
        message: "At least one area of interest is required",
      },
      enum: {
        values: [
          "Dog Walker",
          "Kennel Assistant",
          "Groomer",
          "Photographer",
          "Transport Volunteer",
          "Social Media Coordinator",
          "Event Volunteer",
          "Educational Outreach",
        ],
        message: "Invalid interest selected",
      },
    },
    experience: {
      type: String,
      trim: true,
      maxlength: [1000, "Experience description cannot exceed 1000 characters"],
    },
    reason: {
      type: String,
      required: [true, "Reason for volunteering is required"],
      trim: true,
      maxlength: [1000, "Reason cannot exceed 1000 characters"],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const VolunteerModel = mongoose.model<IVolunteer>(
  "Volunteer",
  VolunteerSchema,
);
