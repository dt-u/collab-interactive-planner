import { z } from "zod";

export const mediaDtoSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  uploaderId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MediaDto = z.infer<typeof mediaDtoSchema>;
