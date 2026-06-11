import { z } from "zod";

// Core Plan
export const createPlanRequestSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;

export const planDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  workspaceId: z.string(),
  creatorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanDto = z.infer<typeof planDtoSchema>;

// Planner Items (Tasks)
export const plannerItemStatusSchema = z.enum(["todo", "in_progress", "done"]);
export type PlannerItemStatus = z.infer<typeof plannerItemStatusSchema>;

export const createPlannerItemRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  columnId: z.string(), // Represents a date (YYYY-MM-DD) or section identifier
  position: z.number().nonnegative(),
  status: plannerItemStatusSchema.default("todo"),
  assignees: z.array(z.string()).default([]),
});
export type CreatePlannerItemRequest = z.infer<
  typeof createPlannerItemRequestSchema
>;

export const updatePlannerItemRequestSchema = createPlannerItemRequestSchema
  .partial()
  .extend({
    // Enable shifting positions/columns
    position: z.number().nonnegative().optional(),
    columnId: z.string().optional(),
  });
export type UpdatePlannerItemRequest = z.infer<
  typeof updatePlannerItemRequestSchema
>;

export const plannerItemDtoSchema = z.object({
  id: z.string(),
  planId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  columnId: z.string(),
  position: z.number(),
  status: plannerItemStatusSchema,
  assignees: z.array(z.string()),
  creatorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlannerItemDto = z.infer<typeof plannerItemDtoSchema>;
