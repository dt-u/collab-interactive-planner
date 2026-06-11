import mongoose from "mongoose";
import { environmentConfig } from "@collab-planner/config";

export class MongooseConnection {
  static async connect(): Promise<void> {
    const mongoUri = environmentConfig.MONGO_URI;

    mongoose.connection.on("connected", () => {
      console.log("🍃 MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected. Retrying...");
    });

    try {
      await mongoose.connect(mongoUri);
    } catch (error) {
      console.error("❌ Initial MongoDB connection failed:", error);
      process.exit(1);
    }
  }

  static async disconnect(): Promise<void> {
    await mongoose.disconnect();
  }
}
