import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

export const environmentSchema = z.object({
  // Ports
  PLAN_SERVICE_PORT: z.coerce.number().default(3001),
  REALTIME_SERVICE_PORT: z.coerce.number().default(3002),
  WEB_PORT: z.coerce.number().default(3000),

  // Node Env
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database & Cache
  MONGO_URI: z.string().url(),
  REDIS_URI: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(8),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // AI
  GEMINI_API_KEY: z.string().min(1),
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

export function loadEnvironmentConfig(
  customEnv?: Record<string, unknown>,
): EnvironmentConfig {
  const envSource = customEnv || process.env;
  const result = environmentSchema.safeParse(envSource);

  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      JSON.stringify(result.error.format(), null, 2),
    );
    throw new Error("Invalid environment configuration");
  }

  return result.data;
}

export const environmentConfig = loadEnvironmentConfig();
