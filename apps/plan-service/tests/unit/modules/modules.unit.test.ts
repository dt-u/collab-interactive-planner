import { describe, it, expect } from "vitest";
import { PlannerItemMapper } from "../../../src/modules/planner-items/planner-item.mapper.js";
import { CommentMapper } from "../../../src/modules/comments/comment.mapper.js";

describe("PlannerItemMapper & CommentMapper", () => {
  it("should map IPlannerItem to DTO", () => {
    const mockId = "6668e1a1234567890abcdef0";
    const mockAssigneeId = "6668e1a1234567890abcdef1";
    const mockItem: any = {
      _id: { toString: () => mockId },
      planId: { toString: () => "6668e1a1234567890abcdef2" },
      title: "Test Task",
      description: "Test task description",
      columnId: "todo",
      position: 3,
      status: "todo",
      assignees: [{ toString: () => mockAssigneeId }],
      creatorId: { toString: () => "6668e1a1234567890abcdef3" },
      createdAt: new Date("2026-06-11T12:00:00Z"),
      updatedAt: new Date("2026-06-11T12:30:00Z"),
    };

    const dto = PlannerItemMapper.toDto(mockItem);
    expect(dto.id).toBe(mockId);
    expect(dto.title).toBe("Test Task");
    expect(dto.position).toBe(3);
    expect(dto.assignees[0]).toBe(mockAssigneeId);
  });

  it("should map IComment to DTO", () => {
    const mockId = "6668e1a1234567890abcdef0";
    const mockUserId = "6668e1a1234567890abcdef1";
    const mockComment: any = {
      _id: { toString: () => mockId },
      itemId: { toString: () => "6668e1a1234567890abcdef2" },
      userId: {
        _id: { toString: () => mockUserId },
        name: "Test User",
        email: "test@user.com",
      },
      content: "Test comment",
      createdAt: new Date("2026-06-11T12:00:00Z"),
      updatedAt: new Date("2026-06-11T12:30:00Z"),
    };

    const dto = CommentMapper.toDto(mockComment);
    expect(dto.id).toBe(mockId);
    expect(dto.userId).toBe(mockUserId);
    expect(dto.content).toBe("Test comment");
  });
});
