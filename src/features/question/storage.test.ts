import { describe, expect, it } from "vitest";
import { MAX_QUESTION_ATTACHMENT_BYTES, questionStoragePath } from "./storage";
describe("question attachment policy", () => {
  it("keeps small attachments under the global action body limit", () => expect(MAX_QUESTION_ATTACHMENT_BYTES).toBe(524288));
  it("uses organization and user scoped random paths", () => expect(questionStoragePath("org", "user", "pdf")).toMatch(/^org\/questions\/user\/[0-9a-f-]{36}\.pdf$/));
});
