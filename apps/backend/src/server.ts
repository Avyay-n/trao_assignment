import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { connectDB } from "./db.js";
import { register, login, me, demoLogin } from "./controllers/auth.js";
import {
  createKit,
  listKits,
  getKit,
  updateKit,
  deleteKit,
  regenerateSection,
  recordPracticeConfidence,
  evaluateMockInterviewAnswer,
  batchCreateKits,
  streamKitProgress,
} from "./controllers/kits.js";
import { authMiddleware } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "prepkit-backend", timestamp: new Date().toISOString() });
});

// Auth Routes (Public)
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.post("/api/auth/demo", demoLogin);

// Auth Me (Protected)
app.get("/api/auth/me", authMiddleware as any, me as any);

// Kit Routes (Protected)
app.post("/api/kits", authMiddleware as any, createKit as any);
app.get("/api/kits", authMiddleware as any, listKits as any);
app.get("/api/kits/:id", authMiddleware as any, getKit as any);
app.put("/api/kits/:id", authMiddleware as any, updateKit as any);
app.delete("/api/kits/:id", authMiddleware as any, deleteKit as any);
app.get("/api/kits/:id/stream", streamKitProgress as any);

// Builder Section Regeneration (Protected)
app.post("/api/kits/:id/regenerate-section", authMiddleware as any, regenerateSection as any);

// Practice Mode Flashcard Ratings (Protected)
app.post("/api/kits/:id/practice", authMiddleware as any, recordPracticeConfidence as any);

// Creative Feature: Mock Interview Evaluation (Protected)
app.post("/api/kits/:id/mock-interview", authMiddleware as any, evaluateMockInterviewAnswer as any);

// Batch Multi-Role Creation (Protected)
app.post("/api/kits/batch", authMiddleware as any, batchCreateKits as any);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Start Server & Connect Database
async function bootstrap() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 PrepKit Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start backend server:", err);
    process.exit(1);
  }
}

bootstrap();
