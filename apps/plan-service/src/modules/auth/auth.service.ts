import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { environmentConfig } from "@collab-planner/config";
import { UserRepository } from "../users/user.repository.js";
import { WorkspaceModel } from "../workspaces/workspace.model.js";
import { PlanModel } from "../planners/planner.model.js";
import { IUser } from "../users/user.model.js";
import { AppError } from "../../middleware/error.middleware.js";
import { withTransaction } from "../../database/transactions.js";

const oAuth2Client = new OAuth2Client(
  environmentConfig.GOOGLE_CLIENT_ID,
  environmentConfig.GOOGLE_CLIENT_SECRET,
  environmentConfig.GOOGLE_CALLBACK_URL,
);

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(private userRepository: UserRepository = new UserRepository()) {}

  getGoogleAuthUrl(): string {
    return oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      prompt: "consent",
    });
  }

  async authenticateWithGoogle(code: string): Promise<{
    user: IUser;
    tokens: AuthTokens;
    isNewUser: boolean;
  }> {
    try {
      // 1. Exchange OAuth code for tokens
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      if (!tokens.id_token) {
        throw new AppError("Failed to retrieve ID token from Google", 400);
      }

      // 2. Verify Google ticket
      const ticket = await oAuth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: environmentConfig.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.name) {
        throw new AppError("Invalid ID token payload", 400);
      }

      const { email, name, picture, sub: googleId } = payload;
      let user = await this.userRepository.findByGoogleId(googleId);
      let isNewUser = false;

      // 3. Register user and onboarding defaults within a Mongoose Transaction
      if (!user) {
        isNewUser = true;
        user = await withTransaction(async (session) => {
          // Check if email already registered via different method
          let existingUser = await this.userRepository.findByEmail(email);
          if (existingUser) {
            existingUser.googleId = googleId;
            existingUser.avatarUrl = picture || existingUser.avatarUrl;
            await existingUser.save({ session });
            return existingUser;
          }

          // Create new user
          const newUser = await this.userRepository.create(
            { email, name, avatarUrl: picture, googleId },
            session,
          );

          // Onboarding: Create Default Workspace
          const workspace = new WorkspaceModel({
            name: `${name}'s Workspace`,
            ownerId: newUser._id,
            members: [{ userId: newUser._id, role: "owner" }],
          });
          await workspace.save({ session });

          // Onboarding: Create Sample Plan Board
          const plan = new PlanModel({
            name: "My First Plan Board",
            description: "Welcome! Here is your initial planning canvas.",
            workspaceId: workspace._id,
            creatorId: newUser._id,
          });
          await plan.save({ session });

          return newUser;
        });
      }

      const authTokens = this.generateTokens({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      });

      return { user, tokens: authTokens, isNewUser };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "OAuth Authentication failed",
        500,
        "AUTH_FAILED",
        error,
      );
    }
  }

  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        environmentConfig.JWT_SECRET,
      ) as TokenPayload;
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new AppError("User not found", 401, "UNAUTHORIZED");
      }

      return this.generateTokens({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      throw new AppError(
        "Invalid or expired refresh token",
        401,
        "UNAUTHORIZED",
      );
    }
  }

  generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, environmentConfig.JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(payload, environmentConfig.JWT_SECRET, {
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
  }
}
