import mongoose from "mongoose";

export async function withTransaction<T>(
  fn: (session?: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // ignore abort errors
      }
      session.endSession();
    }

    // Check if error is due to MongoDB running as standalone (no replica set support)
    const isStandaloneError =
      error?.message?.includes("replica set member") ||
      error?.errmsg?.includes("replica set member") ||
      error?.code === 20 ||
      error?.codeName === "IllegalOperation";

    if (isStandaloneError) {
      console.warn("⚠️ Standalone MongoDB detected. Falling back to executing operation without a transaction.");
      return await fn(undefined);
    }

    throw error;
  }
}
