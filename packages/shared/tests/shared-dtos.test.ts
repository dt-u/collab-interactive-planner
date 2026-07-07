import { describe, it, expect } from "vitest";
import {
  registerRequestSchema,
  loginRequestSchema,
} from "../src/dtos/user.dto.js";
import { createWorkspaceRequestSchema } from "../src/dtos/workspace.dto.js";

describe("Shared Package - User DTOs Schemas", () => {
  it("should validate a correct register payload", () => {
    const payload = {
      email: "test@example.com",
      password: "strongpassword123",
      name: "John Doe",
    };
    const parsed = registerRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should reject invalid email for register", () => {
    const payload = {
      email: "invalid-email",
      password: "strongpassword123",
      name: "John Doe",
    };
    const parsed = registerRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("should reject too short password for register", () => {
    const payload = {
      email: "test@example.com",
      password: "123",
      name: "John Doe",
    };
    const parsed = registerRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});

describe("Shared Package - Workspace DTOs Schemas", () => {
  it("should validate workspace name between 1 and 100 characters", () => {
    const valid = { name: "My Team Workspace" };
    expect(createWorkspaceRequestSchema.safeParse(valid).success).toBe(true);

    const validShort = { name: "A" };
    expect(createWorkspaceRequestSchema.safeParse(validShort).success).toBe(true);

    const tooShort = { name: "" };
    expect(createWorkspaceRequestSchema.safeParse(tooShort).success).toBe(
      false,
    );
  });
});
