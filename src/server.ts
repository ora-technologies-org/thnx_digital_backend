import express, { Request, Response } from "express";
import dotenv from "dotenv";
import session from "express-session";
import passport from "./config/passport.config";
import { configurePassport } from "./config/passport.config";
import authRoutes from "./routes/auth.routes";
import prisma from "./utils/prisma.util";
import giftCardRoutes from "./routes/giftCard.routes";
import purchaseRoutes from "./routes/purchase.routes";
import cors from "cors";
import merchantRoutes from "./routes/merchant.routes";

// Swagger
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.config";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://thnxdigital.com",
  "https://thnxdigital.com",
  "http://www.thnxdigital.com",
  "https://www.thnxdigital.com",
  "https://rncks4z6-8081.inc1.devtunnels.ms",
  "https://rncks4z6-8080.inc1.devtunnels.ms",
  "http://localhost:8081",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) {
      return callback(null, true);
    }
    if (
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === "development"
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "hello123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Initialize Passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// ==================== Swagger Documentation ====================
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Thnx Digital API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "none",
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  })
);

// Swagger JSON endpoint
app.get("/api-docs.json", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Routes
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Thnx Digital API - Welcome!",
    version: "1.0.0",
    documentation: "/api-docs",
    endpoints: {
      auth: "/api/auth",
      merchants: "/api/merchants",
      giftCards: "/api/gift-cards",
      purchases: "/api/purchases",
      health: "/health",
    },
  });
});

// Health check
app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: "unhealthy",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/merchants", merchantRoutes);
app.use("/api/gift-cards", giftCardRoutes);
app.use("/api/purchases", purchaseRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? "Enabled" : "Disabled"}`
  );
});

export default app;