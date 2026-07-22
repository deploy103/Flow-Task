import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("uses the same scalable Flow Task icon as the browser favicon", () => {
    expect(manifest().icons).toContainEqual({
      src: "/icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    });
  });
});
