import mongoose, { Schema, Document } from "mongoose";

// ==========================================
// 1. Snapshot Schema & Model
// ==========================================
export interface IYjsSnapshot extends Document {
  docId: string;
  state: Buffer;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const YjsSnapshotSchema = new Schema<IYjsSnapshot>(
  {
    docId: { type: String, required: true, unique: true, index: true },
    state: { type: Schema.Types.Buffer as any, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const YjsSnapshotModel = mongoose.model<IYjsSnapshot>(
  "YjsSnapshot",
  YjsSnapshotSchema
);

// ==========================================
// 2. Update Log Schema & Model
// ==========================================
export interface IYjsUpdateLog extends Document {
  docId: string;
  update: Buffer;
  createdAt: Date;
}

const YjsUpdateLogSchema = new Schema<IYjsUpdateLog>(
  {
    docId: { type: String, required: true },
    update: { type: Schema.Types.Buffer as any, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Performance Optimization: Compound Index to prevent COLLSCAN
YjsUpdateLogSchema.index({ docId: 1, createdAt: 1 });

export const YjsUpdateLogModel = mongoose.model<IYjsUpdateLog>(
  "YjsUpdateLog",
  YjsUpdateLogSchema
);

// ==========================================
// 3. Persistence Repository Operations
// ==========================================
export const YjsPersistenceRepository = {
  /**
   * Saves or updates a document baseline snapshot state.
   */
  async saveSnapshot(docId: string, state: Buffer, version: number): Promise<void> {
    await YjsSnapshotModel.findOneAndUpdate(
      { docId },
      { state, version },
      { upsert: true, new: true }
    );
  },

  /**
   * Loads the latest snapshot state for a document.
   */
  async getSnapshot(docId: string): Promise<IYjsSnapshot | null> {
    return YjsSnapshotModel.findOne({ docId }).exec();
  },

  /**
   * Appends an incremental client update to the log.
   */
  async appendUpdate(docId: string, update: Buffer): Promise<void> {
    await YjsUpdateLogModel.create({ docId, update });
  },

  /**
   * Retrieves all delta log updates for a document (optionally since a specific date).
   * Sorted sequentially by creation time.
   */
  async getUpdates(docId: string, since?: Date): Promise<IYjsUpdateLog[]> {
    const query: any = { docId };
    if (since) {
      query.createdAt = { $gt: since };
    }
    return YjsUpdateLogModel.find(query).sort({ createdAt: 1 }).exec();
  },

  /**
   * Deletes delta update log records up to and including a specific timestamp boundary.
   * This is part of the race-condition-free Compaction strategy.
   */
  async deleteUpdates(docId: string, beforeOrAt: Date): Promise<number> {
    const res = await YjsUpdateLogModel.deleteMany({
      docId,
      createdAt: { $lte: beforeOrAt }
    });
    return res.deletedCount || 0;
  }
};
