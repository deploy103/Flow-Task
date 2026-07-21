import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  canSubmitAssignment: vi.fn(),
  findMembership: vi.fn(),
  findAssignment: vi.fn(),
  findUploads: vi.fn(),
  updateUploads: vi.fn(),
  removeSubmissionFile: vi.fn(),
}));

vi.mock("@/features/auth/api", () => ({ getApiUser: mocks.getApiUser }));
vi.mock("@/features/submission/access", () => ({ canSubmitAssignment: mocks.canSubmitAssignment }));
vi.mock("@/features/submission/storage", () => ({
  createSubmissionStoragePath: vi.fn(),
  removeSubmissionFile: mocks.removeSubmissionFile,
  uploadSubmissionFile: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: { findUnique: mocks.findMembership },
    assignment: { findFirst: mocks.findAssignment },
    submissionUpload: {
      findMany: mocks.findUploads,
      updateMany: mocks.updateUploads,
    },
  },
}));

import { DELETE } from "./route";

const organizationId = "00000000-0000-4000-8000-000000000001";
const assignmentId = "00000000-0000-4000-8000-000000000002";
const uploadId = "00000000-0000-4000-8000-000000000003";

describe("DELETE submission upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000004" });
    mocks.canSubmitAssignment.mockReturnValue(true);
    mocks.findMembership.mockResolvedValue({ status: "ACTIVE" });
    mocks.findAssignment.mockResolvedValue({
      id: assignmentId,
      audience: "ALL_MEMBERS",
      fields: [],
      targets: [],
      opensAt: new Date(0),
      deadline: new Date("2999-01-01T00:00:00.000Z"),
      allowLate: false,
    });
    mocks.findUploads.mockResolvedValue([{ id: uploadId, storagePath: "safe/path/file.pdf" }]);
    mocks.updateUploads.mockResolvedValue({ count: 1 });
    mocks.removeSubmissionFile.mockResolvedValue(undefined);
  });

  it("accepts the JSON request sent by the file input and cancels pending uploads", async () => {
    const body = JSON.stringify({ uploadIds: [uploadId] });
    const request = new Request("http://localhost/submission-uploads", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(new TextEncoder().encode(body).byteLength),
      },
      body,
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ organizationId, assignmentId }),
    });

    expect(response).toBeDefined();
    if (!response) throw new Error("Expected a cancellation response.");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { cancelled: 1 } });
    expect(mocks.updateUploads).toHaveBeenCalledOnce();
    expect(mocks.removeSubmissionFile).toHaveBeenCalledWith("safe/path/file.pdf");
  });
});
