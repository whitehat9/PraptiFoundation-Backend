import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";
import AdminModel from "../models/adminModel";
import EditorModel from "../models/editorModel";
import {
  AuthenticatedUser,
  UserRole,
  ROLES,
  getUserRole,
} from "../constants/roles";
import { ErrorResponse } from "../constants/errorResponse";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface JwtPayload {
  id: string;
  role?: UserRole;
}

export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer")) {
      return next(new ErrorResponse("Not authorized, no token", 401));
    }

    const token = header.split(" ")[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return next(new ErrorResponse("Not authorized, token failed", 401));
    }

    // Resolve against the collection indicated by the token role.
    // Admin tokens may lack a role claim (legacy) -> default to Admin lookup.
    let user: AuthenticatedUser | null = null;

    if (decoded.role === ROLES.EDITOR) {
      user = await EditorModel.findById(decoded.id).select("-password");
    } else {
      user = await AdminModel.findById(decoded.id).select("-password");
      // Fallback for tokens minted before role claim existed.
      if (!user) {
        user = await EditorModel.findById(decoded.id).select("-password");
      }
    }

    if (!user) {
      return next(new ErrorResponse("User not found", 401));
    }

    req.user = user;
    next();
  },
);

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ErrorResponse("User not found", 401));
    }
    const userRole = getUserRole(req.user);
    if (!roles.includes(userRole)) {
      return next(
        new ErrorResponse(
          `Role "${userRole}" is not authorized to access this route`,
          403,
        ),
      );
    }
    next();
  };
};
