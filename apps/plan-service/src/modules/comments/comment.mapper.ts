import { CommentDto } from "@collab-planner/shared";
import { IComment } from "./comment.model.js";

export class CommentMapper {
  static toDto(comment: IComment): CommentDto {
    return {
      id: comment._id.toString(),
      itemId: comment.itemId.toString(),
      userId: comment.userId._id?.toString() || comment.userId.toString(),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }
}
