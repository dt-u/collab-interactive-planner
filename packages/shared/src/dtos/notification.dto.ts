import { z } from "zod";

export const notificationDtoSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  senderId: z.string().optional(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  read: z.boolean(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NotificationDto = z.infer<typeof notificationDtoSchema>;
