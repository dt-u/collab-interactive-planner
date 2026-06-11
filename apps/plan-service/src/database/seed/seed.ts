import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  color: { type: String, required: true },
});
export const CategoryModel =
  mongoose.models.Category || mongoose.model("Category", CategorySchema);

const PermissionSchema = new Schema({
  role: { type: String, required: true, unique: true },
  permissions: { type: [String], required: true },
});
export const PermissionModel =
  mongoose.models.Permission || mongoose.model("Permission", PermissionSchema);

export async function seedDatabase(): Promise<void> {
  console.log("🌱 Checking system metadata seeding status...");

  // 1. Seed Categories
  const categoryCount = await CategoryModel.countDocuments();
  if (categoryCount === 0) {
    console.log("🚀 Seeding default task categories...");
    await CategoryModel.insertMany([
      { name: "To Do", code: "todo", color: "#FF5733" },
      { name: "In Progress", code: "in_progress", color: "#FFA833" },
      { name: "Done", code: "done", color: "#33FF57" },
    ]);
    console.log("✅ Default task categories seeded.");
  }

  // 2. Seed Role-Permission Mappings
  const permissionCount = await PermissionModel.countDocuments();
  if (permissionCount === 0) {
    console.log("🚀 Seeding default role-permission mappings...");
    await PermissionModel.insertMany([
      {
        role: "owner",
        permissions: [
          "workspace:read",
          "workspace:update",
          "workspace:delete",
          "workspace:invite",
          "plan:create",
          "plan:read",
          "plan:update",
          "plan:delete",
          "task:create",
          "task:read",
          "task:update",
          "task:delete",
          "task:move",
        ],
      },
      {
        role: "admin",
        permissions: [
          "workspace:read",
          "workspace:invite",
          "plan:create",
          "plan:read",
          "plan:update",
          "plan:delete",
          "task:create",
          "task:read",
          "task:update",
          "task:delete",
          "task:move",
        ],
      },
      {
        role: "member",
        permissions: [
          "workspace:read",
          "plan:read",
          "task:create",
          "task:read",
          "task:update",
          "task:move",
        ],
      },
    ]);
    console.log("✅ Role-permission mappings seeded.");
  }
}
