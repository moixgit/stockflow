import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Warehouse, Category } from "../models/index.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongodb:27017/stockflow";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Seed admin user
  const existing = await mongoose.connection
    .collection("users")
    .findOne({ email: "admin@stockflow.com" });
  if (existing) {
    await mongoose.connection
      .collection("users")
      .deleteOne({ email: "admin@stockflow.com" });
    console.log("🗑  Removed existing admin");
  }

  const hash = await bcrypt.hash("admin123", 10);
  // Use insertOne directly to bypass the pre-save hook (which would double-hash the password)
  await mongoose.connection.collection("users").insertOne({
    name: "System Admin",
    email: "admin@stockflow.com",
    password: hash,
    role: "admin",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("👤 Admin created: admin@stockflow.com / admin123");

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
