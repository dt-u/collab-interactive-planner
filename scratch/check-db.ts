import mongoose from "mongoose";

async function checkDb() {
  const uri = "mongodb://localhost:27017/collab_planner";
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`Collections in database '${db.databaseName}':`);

    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(` - ${col.name}: ${count} documents`);
    }
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

checkDb();
