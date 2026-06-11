import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const oauthCallbackRequestSchema = z.object({
  code: z.string(),
});

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().optional(),
  createdAt: z.string(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type OAuthCallbackRequest = z.infer<typeof oauthCallbackRequestSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
