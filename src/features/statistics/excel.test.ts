import { describe, expect, it } from "vitest";
import { safeSpreadsheetText } from "./excel";

describe("Excel export safety", () => {
  it("neutralizes spreadsheet formula prefixes", () => {
    for (const value of ["=CMD()", "+1", "-1", "@SUM(A1)"]) expect(safeSpreadsheetText(value)).toBe(`'${value}`);
    expect(safeSpreadsheetText("일반 텍스트")).toBe("일반 텍스트");
  });
});
