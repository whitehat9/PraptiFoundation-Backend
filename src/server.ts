import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";

import corsOptions from "./config/corOptions";
import logger from "./utils/logger";
import connectDB from "./config/dbConnection";
import { routeNotFound } from "./middleware/errorMiddleware";
import auth from "./routes/auth";
import blogs from "./routes/blog";
import cloudinaryRoutes from "./routes/cloudinary";
import volunteerRoutes from "./routes/volunteer";
import contactRoutes from "./routes/contact";
import categoryRoutes from "./routes/category";
import photosRoutes from "./routes/photos";
import videosRoutes from "./routes/video";
import visitorRoutes from "./routes/visitor";
import impactRoutes from "./routes/impact";
import testimonialsRoutes from "./routes/testimonials";
import awardsRoutes from "./routes/awards";
import rescueRoutes from "./routes/rescue";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan("combined", {
    stream: { write: (message: string) => logger.info(message.trim()) },
  }),
);

// Health check endpoints
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Prapti Foundation API is running",
    version: "1.0.0",
  });
});
app.get("/_ah/health", (_req: Request, res: Response) =>
  res.status(200).send("OK"),
);
app.get("/_ah/start", (_req: Request, res: Response) =>
  res.status(200).send("OK"),
);
app.get("/favicon.ico", (_req: Request, res: Response) =>
  res.status(204).end(),
);

// Routes
app.use("/api/auth", auth);
app.use("/api/blogs", blogs);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/messages", contactRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/photos", photosRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/visitor", visitorRoutes);
app.use("/api/impact", impactRoutes);
app.use("/api/testimonials", testimonialsRoutes);
app.use("/api/awards", awardsRoutes);
app.use("/api/rescue", rescueRoutes);

// 404 — must come after all routes
app.use(routeNotFound);

// Global error handler — must be last
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Preserve statusCode set by controllers (401, 400, 404, etc.)
  // Only default to 500 if nothing was set
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  logger.error("Global error handler:", {
    statusCode,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? "Something went wrong!" : "Request failed",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : statusCode === 500
          ? "Internal server error"
          : err.message,
  });
});

// Connect to MongoDB
connectDB();

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

export default app;
