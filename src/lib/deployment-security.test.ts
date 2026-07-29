import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compose = readFileSync(new URL("../../deploy/docker-compose.example.yml", import.meta.url), "utf8");
const dockerfile = readFileSync(new URL("../../deploy/Dockerfile", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("deployment defense in depth", () => {
  it("pins build and runtime images to immutable digests", () => {
    expect(dockerfile.match(/^FROM node:24-alpine@sha256:[0-9a-f]{64}/gm)).toHaveLength(3);
    expect(compose).toMatch(/image: postgres:17-alpine@sha256:[0-9a-f]{64}/);
    expect(compose).toMatch(/image: boky\/postfix:v5\.1\.0-alpine@sha256:[0-9a-f]{64}/);
  });

  it("runs the application and migration with reduced privileges", () => {
    expect(compose).toContain("read_only: true");
    expect(compose.match(/no-new-privileges:true/g)?.length).toBeGreaterThanOrEqual(3);
    expect(compose.match(/cap_drop:\n\s+- ALL/g)).toHaveLength(2);
    expect(compose).toContain('user: "1001:1001"');
    expect(compose).toContain("pids_limit: 128");
    expect(compose).toContain("pids_limit: 256");
    expect(compose).toMatch(/app_network:\n\s+driver: bridge\n\s+internal: true/);
    expect(compose).toMatch(/mail_network:\n\s+gw_priority: 1/);
  });

  it("pins third-party CI actions to full commit hashes", () => {
    const actionReferences = [...workflow.matchAll(/uses: ([^\s#]+)/g)].map((match) => match[1]);
    expect(actionReferences.length).toBeGreaterThan(0);
    for (const reference of actionReferences) expect(reference).toMatch(/@[0-9a-f]{40}$/);
  });
});
