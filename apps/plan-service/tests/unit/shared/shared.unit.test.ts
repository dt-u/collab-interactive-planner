import { describe, it, expect } from "vitest";
import { PlannerMapper } from "../../../src/modules/planners/planner.mapper.js";

describe("PlannerMapper", () => {
  it("should map IPlan to PlanDto correctly", () => {
    const mockId = "6668e1a1234567890abcdef0";
    const mockPlan: any = {
      _id: { toString: () => mockId },
      name: "Test Plan",
      description: "Test description",
      workspaceId: { toString: () => "6668e1a1234567890abcdef1" },
      creatorId: { toString: () => "6668e1a1234567890abcdef2" },
      createdAt: new Date("2026-06-11T12:00:00Z"),
      updatedAt: new Date("2026-06-11T12:30:00Z"),
    };

    const dto = PlannerMapper.toDto(mockPlan);

    expect(dto.id).toBe(mockId);
    expect(dto.name).toBe("Test Plan");
    expect(dto.description).toBe("Test description");
    expect(dto.workspaceId).toBe("6668e1a1234567890abcdef1");
    expect(dto.creatorId).toBe("6668e1a1234567890abcdef2");
    expect(dto.createdAt).toBe(mockPlan.createdAt.toISOString());
    expect(dto.updatedAt).toBe(mockPlan.updatedAt.toISOString());
  });
});
