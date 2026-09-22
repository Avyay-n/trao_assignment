import mongoose from "mongoose";
import { setUsingMemoryStore } from "./models/store.js";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      console.log(`[Database] Attempting connection to MongoDB at: ${uri}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log("[Database] Connected to external MongoDB successfully.");
      setUsingMemoryStore(false);
      return;
    } catch (err: any) {
      console.warn(`[Database] External MongoDB connection failed (${err.message}). Activating in-memory store.`);
    }
  } else {
    console.info("[Database] No MONGODB_URI provided. Initializing resilient in-memory store for local execution.");
  }

  setUsingMemoryStore(true);
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
