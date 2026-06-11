import { z } from "zod";

export const createCommentRequestSchema = z.object({
  content: z.string().min(1).max(1000),
});
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;

export const commentDtoSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CommentDto = z.infer<typeof commentDtoSchema>;
