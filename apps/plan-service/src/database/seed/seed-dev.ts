import mongoose from "mongoose";
import { environmentConfig } from "@collab-planner/config";
import { UserModel } from "../../modules/users/user.model.js";
import { WorkspaceModel } from "../../modules/workspaces/workspace.model.js";
import { PlanModel } from "../../modules/planners/planner.model.js";
import { PlannerItemModel } from "../../modules/planner-items/planner-item.model.js";
import { seedDatabase } from "./seed.js";

async function runDevSeed(): Promise<void> {
  console.log("Running Developer Mock Data Seeding...");
  const mongoUri = environmentConfig.MONGO_URI;

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding.");

    // Run system metadata seeding first to ensure default role mappings exist
    await seedDatabase();

    // 1. Clear existing domain collections
    console.log("Clearing users, workspaces, plans, and tasks...");
    await UserModel.deleteMany({});
    await WorkspaceModel.deleteMany({});
    await PlanModel.deleteMany({});
    await PlannerItemModel.deleteMany({});

    // 2. Seed Mock Users
    console.log("Seeding mock users...");
    const users = await UserModel.insertMany([
      {
        email: "john@example.com",
        name: "John Doe",
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=john",
        googleId: "google-john-123",
      },
      {
        email: "jane@example.com",
        name: "Jane Smith",
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=jane",
        googleId: "google-jane-456",
      },
      {
        email: "bob@example.com",
        name: "Bob Johnson",
        avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=bob",
        googleId: "google-bob-789",
      },
    ]);

    const [john, jane, bob] = users;

    // 3. Seed Mock Workspaces
    console.log("🏢 Seeding mock workspaces...");
    const workspaces = await WorkspaceModel.insertMany([
      {
        name: "Acme Corp Workspace",
        ownerId: john._id,
        members: [
          { userId: john._id, role: "owner" },
          { userId: jane._id, role: "admin" },
          { userId: bob._id, role: "member" },
        ],
      },
      {
        name: "Jane's Freelance Work",
        ownerId: jane._id,
        members: [
          { userId: jane._id, role: "owner" },
          { userId: john._id, role: "member" },
        ],
      },
    ]);

    const [acmeWorkspace, freelanceWorkspace] = workspaces;

    // 4. Seed Mock Plans (Boards)
    console.log("📋 Seeding mock plans...");
    const plans = await PlanModel.insertMany([
      {
        name: "Q3 Product Roadmap",
        description: "High level product planning for Q3 releases",
        workspaceId: acmeWorkspace._id,
        creatorId: john._id,
      },
      {
        name: "Sprint 12 Board",
        description: "Active sprint items",
        workspaceId: acmeWorkspace._id,
        creatorId: jane._id,
      },
      {
        name: "Client Website Redesign",
        description: "Rebuilding company website using NextJS",
        workspaceId: freelanceWorkspace._id,
        creatorId: jane._id,
      },
    ]);

    const [roadmapPlan, sprintPlan] = plans;

    // 5. Seed Tasks (Planner Items)
    console.log("📌 Seeding mock task items...");
    await PlannerItemModel.insertMany([
      // Roadmap tasks (Column YYYY-MM-DD representing weeks/days or categories)
      {
        planId: roadmapPlan._id,
        title: "Integrate Yjs and Socket.IO for real-time collaboration",
        description: "Write custom provider for syncing document operations",
        columnId: "2026-06-15",
        position: 0,
        status: "in_progress",
        assignees: [john._id, jane._id],
        creatorId: john._id,
      },
      {
        planId: roadmapPlan._id,
        title: "Configure Nginx reverse gateway routing paths",
        description: "Set up /api and /socket.io routing on port 80",
        columnId: "2026-06-15",
        position: 1,
        status: "done",
        assignees: [john._id],
        creatorId: john._id,
      },
      {
        planId: roadmapPlan._id,
        title: "Deploy Docker Desktop configurations local stack",
        description: "Create compose templates and verify DB volume stores",
        columnId: "2026-06-16",
        position: 0,
        status: "todo",
        assignees: [bob._id],
        creatorId: jane._id,
      },
      // Sprint board tasks
      {
        planId: sprintPlan._id,
        title: "Implement JWT token rotation middleware flow",
        description: "Setup access token 15min and refresh token cookie 7d",
        columnId: "todo",
        position: 0,
        status: "todo",
        assignees: [jane._id],
        creatorId: jane._id,
      },
      {
        planId: sprintPlan._id,
        title: "Write Zod validation middlewares",
        description: "Extract express handlers checking request body and query",
        columnId: "todo",
        position: 1,
        status: "todo",
        assignees: [john._id],
        creatorId: jane._id,
      },
    ]);

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed with error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

// Run the script directly if invoked from command line
runDevSeed();
