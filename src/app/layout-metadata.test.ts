import { describe, expect, it } from "vitest";
import { metadata, viewport } from "./layout";

describe("root viewport metadata", () => {
  it("enables iOS safe-area viewport insets", () => {
    expect(viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
    });
  });

  it("publishes the Flow Task icon as the browser favicon", () => {
    expect(metadata.icons).toEqual({
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      shortcut: "/icon.svg",
    });
  });
});
