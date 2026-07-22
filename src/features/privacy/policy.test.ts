import { describe, expect, it } from "vitest";
import { MINIMUM_SIGNUP_AGE, PRIVACY_POLICY_VERSION } from "@/constants/privacy";
import { PRIVACY_POLICY_SECTIONS } from "./policy";

describe("privacy policy disclosures", () => {
  const policyText = PRIVACY_POLICY_SECTIONS
    .flatMap(({ title, content }) => [title, ...content])
    .join("\n");

  it("uses a version that can be stored with consent evidence", () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(["이름", "이메일", "생년월일", "학번", "목적", "보유", "삭제", "거부"])(
    "discloses required item: %s",
    (item) => expect(policyText).toContain(item),
  );

  it("discloses the child policy and email processor", () => {
    expect(policyText).toContain(`만 ${MINIMUM_SIGNUP_AGE}세`);
    expect(policyText).toContain("Resend");
  });
});
