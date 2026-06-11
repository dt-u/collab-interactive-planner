export interface FeatureFlags {
  enableAiAssist: boolean;
  enableComments: boolean;
  enableRealtimeSync: boolean;
  enableAwareness: boolean;
  enableOptimisticUi: boolean;
}

export const featureFlags: FeatureFlags = {
  enableAiAssist: process.env.ENABLE_AI_ASSIST !== "false",
  enableComments: process.env.ENABLE_COMMENTS !== "false",
  enableRealtimeSync: process.env.ENABLE_REALTIME_SYNC !== "false",
  enableAwareness: process.env.ENABLE_AWARENESS !== "false",
  enableOptimisticUi: process.env.ENABLE_OPTIMISTIC_UI !== "false",
};
