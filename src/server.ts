import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";

import corsOptions from "./config/corOptions";
import logger from "./utils/logger";
import connectDB from "./config/dbConnection";
import { errorHandler, routeNotFound } from "./middleware/errorMiddleware";
import auth from "./routes/auth";
import blogs from "./routes/blog";
import cloudinaryRoutes from "./routes/cloudinary";
import volunteerRoutes from "./routes/volunteer";
import contactRoutes from "./routes/contact";
//updated
import categoryRoutes from "./routes/category";
import photosRoutes from "./routes/photos";
import videosRoutes from "./routes/video";
import visitorRoutes from "./routes/visitor";
//new
import impactRoutes from "./routes/impact";
import testimonialsRoutes from "./routes/testimonials";
//
import awardsRoutes from "./routes/awards";
import rescueRoutes from "./routes/rescue";

// Create Express application
const app: Application = express();
dotenv.config();

const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());

//CORS - must come before compression
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(
  morgan("combined", {
    stream: { write: (message: string) => logger.info(message.trim()) },
  }),
);

// Health check endpoints (no rate limiting)
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Prapti Foundation API is running",
    version: "1.0.0",
  });
});
app.get("/_ah/health", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.get("/_ah/start", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

// Handle favicon.ico requests silently
app.get("/favicon.ico", (req: Request, res: Response) => {
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Listening to http://localhost:${PORT}`);
});

app.use("/api/auth", auth);
app.use("/api/blogs", blogs);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/messages", contactRoutes);
//
app.use("/api/categories", categoryRoutes);
app.use("/api/photos", photosRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/visitor", visitorRoutes);
//
app.use("/api/impact", impactRoutes);
app.use("/api/testimonials", testimonialsRoutes);
//
app.use("/api/awards", awardsRoutes);
app.use("/api/rescue", rescueRoutes);

// Global error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(500).json({
    success: false,
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// Centralized Error Handler
app.use(routeNotFound);
app.use(errorHandler);

// Connect to MongoDB
connectDB();
