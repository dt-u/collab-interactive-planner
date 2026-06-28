import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { environmentConfig } from "@collab-planner/config";
import { UserModel } from "../apps/plan-service/src/modules/users/user.model.js";

async function generateDevToken() {
  const uri = environmentConfig.MONGO_URI;
  try {
    await mongoose.connect(uri);

    // Find John Doe
    const john = await UserModel.findOne({ email: "john@example.com" });
    if (!john) {
      console.log("Mock user 'john@example.com' not found. Run db:seed first!");
      return;
    }

    const payload = {
      userId: john._id.toString(),
      email: john.email,
      name: john.name,
    };

    // Sign a token that lasts 7 days for easy local testing!
    const token = jwt.sign(payload, environmentConfig.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("\n--- DEVELOPER TEST TOKENS ---");
    console.log(`User: ${john.name} (${john.email})`);
    console.log(`User ID: ${john._id.toString()}`);
    console.log(`Access Token:\n\n${token}\n`);

    console.log("--- SAMPLE HTTP REQUESTS FOR POSTMAN/CURL ---");
    console.log(`1. Get workspaces of John:
   GET http://localhost/api/workspaces
   Headers: Authorization: Bearer ${token}
`);

    console.log("2. Use the returned Workspace ID to fetch its boards:");
    console.log("   GET http://localhost/api/workspaces/<WORKSPACE_ID>/plans");
    console.log(`   Headers: Authorization: Bearer ${token}\n`);

  } catch (error) {
    console.error("Error generating dev token:", error);
  } finally {
    await mongoose.disconnect();
  }
}

generateDevToken();
