import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  overrides?: { "brace-expansion"?: string; next?: { postcss?: string } };
  scripts?: { postinstall?: string };
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

  it("uses patched brace expansion with a deterministic legacy API adapter", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as PackageManifest;
    const adapter = readFileSync(
      new URL("../../deploy/scripts/patch-brace-expansion-compat.mjs", import.meta.url),
      "utf8",
    );

    expect(manifest.overrides?.["brace-expansion"]).toBe("5.0.8");
    expect(manifest.scripts?.postinstall).toBe(
      "node deploy/scripts/patch-brace-expansion-compat.mjs",
    );
    expect(adapter).toContain("braceExpansion.expand");
  });
});
