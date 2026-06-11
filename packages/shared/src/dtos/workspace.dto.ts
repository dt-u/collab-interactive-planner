import { z } from "zod";

export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url().optional(),
  role: memberRoleSchema,
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(2).max(100),
});
export type CreateWorkspaceRequest = z.infer<
  typeof createWorkspaceRequestSchema
>;

export const inviteMemberRequestSchema = z.object({
  email: z.string().email(),
  role: memberRoleSchema.default("member"),
});
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;

export const workspaceDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  members: z.array(workspaceMemberSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkspaceDto = z.infer<typeof workspaceDtoSchema>;
