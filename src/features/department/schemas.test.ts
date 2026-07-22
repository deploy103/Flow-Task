import { describe, expect, it } from "vitest";
import { createDepartmentSchema, departmentMemberSchema, departmentMessageSchema } from "./schemas";

const organizationId = "550e8400-e29b-41d4-a716-446655440000";
const departmentId = "2f6d37ce-4d5b-4650-a1e3-e7e34052ad15";
const userId = "16768a06-470c-4d5a-9d26-ec7e8f4f82a0";

describe("department schemas", () => {
  it("normalizes a department description", () => {
    expect(createDepartmentSchema.parse({ organizationId, name: "기능부", description: "" }).description).toBeNull();
  });

  it("accepts a leader and deduplicated members at the action boundary", () => {
    expect(departmentMemberSchema.safeParse({ organizationId, departmentId, leaderId: userId, memberIds: [userId] }).success).toBe(true);
  });

  it("rejects empty and oversized messages", () => {
    expect(departmentMessageSchema.safeParse({ organizationId, departmentId, content: "  " }).success).toBe(false);
    expect(departmentMessageSchema.safeParse({ organizationId, departmentId, content: "가".repeat(2001) }).success).toBe(false);
  });
});
