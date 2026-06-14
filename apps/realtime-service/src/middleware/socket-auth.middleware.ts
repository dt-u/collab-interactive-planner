import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { environmentConfig } from "@collab-planner/config";

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: any) => void,
): void {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token;

  if (!token) {
    console.warn(`⚠️ Connection rejected: No token provided on socket ${socket.id}`);
    next(new Error("UNAUTHORIZED: No authentication token provided"));
    return;
  }

  // Handle case where token might be sent as "Bearer <token>"
  const tokenStr = typeof token === "string" && token.startsWith("Bearer ")
    ? token.split(" ")[1]
    : (token as string);

  try {
    const decoded = jwt.verify(tokenStr, environmentConfig.JWT_SECRET) as {
      userId: string;
      email: string;
      name: string;
    };

    // Store user data in socket session
    socket.data.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    console.log(`👤 Socket ${socket.id} authenticated successfully as user: ${decoded.email}`);
    next();
  } catch (error) {
    console.warn(`⚠️ Connection rejected: Invalid token on socket ${socket.id}`, error);
    next(new Error("UNAUTHORIZED: Invalid or expired token"));
  }
}
