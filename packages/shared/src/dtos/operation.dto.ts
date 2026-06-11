import { z } from "zod";

export const plannerOperationDtoSchema = z.object({
  id: z.string(),
  planId: z.string(),
  userId: z.string(),
  operationType: z.string(),
  payload: z.record(z.any()),
  createdAt: z.string(),
});
export type PlannerOperationDto = z.infer<typeof plannerOperationDtoSchema>;
