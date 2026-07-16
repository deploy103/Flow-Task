import { describe, expect, it } from "vitest";
import { MAX_SUBMISSION_FILE_SIZE_BYTES } from "@/constants/assignment";
import {
  hasValidSubmissionFileSignature,
  isSafeSubmissionUrl,
  validateSubmissionFile,
} from "./policy";

describe("submission URL policy", () => {
  it("allows HTTP(S) links and rejects executable or malformed schemes", () => {
    expect(isSafeSubmissionUrl("https://github.com/example/project")).toBe(true);
    expect(isSafeSubmissionUrl("http://localhost:3000/preview")).toBe(true);
    expect(isSafeSubmissionUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeSubmissionUrl("data:text/html,test")).toBe(false);
    expect(isSafeSubmissionUrl("not-a-url")).toBe(false);
  });
});

describe("submission file policy", () => {
  it("requires an allowed extension and matching MIME type", () => {
    expect(validateSubmissionFile(new File(["pdf"], "report.pdf", { type: "application/pdf" }))).toMatchObject({
      extension: "pdf",
      originalFilename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
    });
    expect(validateSubmissionFile(new File(["pdf"], "report.exe", { type: "application/pdf" }))).toBeNull();
    expect(validateSubmissionFile(new File(["pdf"], "report.pdf", { type: "application/x-msdownload" }))).toBeNull();
  });

  it("checks file signatures instead of trusting browser metadata", async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "report.pdf", {
      type: "application/pdf",
    });
    const fakePdf = new File(["plain text"], "report.pdf", { type: "application/pdf" });
    const zip = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "source.zip", {
      type: "application/zip",
    });
    expect(await hasValidSubmissionFileSignature(pdf, "pdf")).toBe(true);
    expect(await hasValidSubmissionFileSignature(fakePdf, "pdf")).toBe(false);
    expect(await hasValidSubmissionFileSignature(zip, "zip")).toBe(true);
  });

  it("rejects empty, oversized, path-like, and control-character filenames", () => {
    expect(validateSubmissionFile(new File([], "empty.pdf", { type: "application/pdf" }))).toBeNull();
    const oversized = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_SUBMISSION_FILE_SIZE_BYTES + 1 });
    expect(validateSubmissionFile(oversized)).toBeNull();
    expect(validateSubmissionFile(new File(["x"], "../safe.pdf", { type: "application/pdf" }))).toMatchObject({
      originalFilename: "safe.pdf",
    });
    expect(validateSubmissionFile(new File(["x"], "bad\u0000.pdf", { type: "application/pdf" }))).toBeNull();
  });
});
