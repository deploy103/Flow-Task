const FORMULA_PREFIX_PATTERN = /^(?:[=+\-@\t\r]|\s+[=+\-@])/;

export function escapeCsvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  const safeText = FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function createCsvRow(values: (string | number | null | undefined)[]) {
  return values.map(escapeCsvCell).join(",");
}
