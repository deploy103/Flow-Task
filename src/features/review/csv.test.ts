import { describe, expect, it } from "vitest";
import { createCsvRow, escapeCsvCell } from "./csv";

describe("review CSV", () => {
  it("escapes quotes and blocks spreadsheet formulas", () => {
    expect(escapeCsvCell('Kim "Admin"')).toBe('"Kim ""Admin"""');
    expect(escapeCsvCell("=HYPERLINK(\"https://evil\")")).toBe(
      '"\'=HYPERLINK(""https://evil"")"',
    );
    expect(escapeCsvCell("+SUM(1,2)")).toBe('"\'+SUM(1,2)"');
    expect(escapeCsvCell("  =1+1")).toBe('"\'  =1+1"');
  });

  it("creates a consistently quoted row", () => {
    expect(createCsvRow(["name", 95, null])).toBe('"name","95",""');
  });
});
