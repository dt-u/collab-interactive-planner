import { UserDto } from "@collab-planner/shared";
import { IUser } from "./user.model.js";

export class UserMapper {
  static toDto(user: IUser): UserDto {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
