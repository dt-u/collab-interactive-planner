import { CommentDto } from "@collab-planner/shared";
import { IComment } from "./comment.model.js";

export class CommentMapper {
  static toDto(comment: IComment): CommentDto {
    const user = comment.userId as any;
    return {
      id: comment._id.toString(),
      itemId: comment.itemId.toString(),
      userId: user._id?.toString() || user.toString(),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      authorId: user._id ? {
        _id: user._id.toString(),
        name: user.name,
        avatarUrl: user.avatarUrl,
      } : undefined,
    };
  }
}
