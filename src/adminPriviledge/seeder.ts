import asyncHandler from "express-async-handler";
import AdminModel from "../models/adminModel";

/**
 * @desc    Seed admin user
 * @route   POST /api/auth/seed
 * @access  Public (should be protected in production)
 */
const seedAdmin = asyncHandler(async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await AdminModel.findOne({
      email: "praptiFoundation@gmail.com",
    });

    if (!existingAdmin) {
      // Create admin user
      const admin = await AdminModel.create({
        name: "prapti",
        email: "praptiFoundation@gmail.com",
        password: "admin123",
      });

      // Return success response
      res.status(201).json({
        success: true,
        message: "Admin user created successfully",
        data: {
          name: admin.name,
          email: admin.email,
        },
      });
    } else {
      // Admin already exists
      res.status(200).json({
        success: true,
        message: "Admin user already exists",
        data: {
          name: existingAdmin.name,
          email: existingAdmin.email,
        },
      });
    }
  } catch (error) {
    res.status(500);
    throw new Error(
      `Error seeding admin: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
});

export default seedAdmin;
