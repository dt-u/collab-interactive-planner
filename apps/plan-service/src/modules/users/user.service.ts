import { UserRepository } from "./user.repository.js";
import { UserMapper } from "./user.mapper.js";
import { UserDto } from "@collab-planner/shared";
import { AppError } from "../../middleware/error.middleware.js";

export class UserService {
  constructor(private userRepository: UserRepository = new UserRepository()) {}

  async getUserProfile(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    return UserMapper.toDto(user);
  }
}
