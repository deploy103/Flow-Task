import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  overrides?: { next?: { postcss?: string } };
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

function expectPatchedPostcss(version: string | undefined) {
  expect(version).toMatch(/^8\.5\.\d+$/);
  const patch = Number(version?.split(".")[2]);
  expect(patch).toBeGreaterThanOrEqual(12);
}

describe("dependency security policy", () => {
  it("does not pin Next.js to the vulnerable PostCSS release", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as PackageManifest;
    const lock = JSON.parse(
      readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
    ) as PackageLock;

    expectPatchedPostcss(manifest.overrides?.next?.postcss);
    expectPatchedPostcss(lock.packages?.["node_modules/next/node_modules/postcss"]?.version);
  });
});
