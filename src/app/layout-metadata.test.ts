import { describe, expect, it } from "vitest";
import { viewport } from "./layout";

describe("root viewport metadata", () => {
  it("enables iOS safe-area viewport insets", () => {
    expect(viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
    });
  });
});
