import { MediaDto } from "@collab-planner/shared";
import { IMedia } from "./media.model.js";

export class MediaMapper {
  static toDto(media: IMedia): MediaDto {
    return {
      id: media._id.toString(),
      itemId: media.itemId.toString(),
      fileName: media.fileName,
      fileUrl: media.fileUrl,
      fileSize: media.fileSize,
      mimeType: media.mimeType,
      uploaderId: media.uploaderId.toString(),
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    };
  }
}
