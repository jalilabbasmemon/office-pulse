/**
 * SEC-F-003 — Neutralize spreadsheet formula injection.
 * Values starting with = + - @ or whitespace/control then formula markers
 * are forced to text by prefixing a single quote (Excel/LibreOffice convention).
 */
export function asExcelText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  let s = String(value);
  // Strip leading BOM / zero-width that can hide formula markers
  s = s.replace(/^\uFEFF/, "");

  const trimmedStart = s.replace(/^[\s\u0000-\u001f]+/, "");
  if (/^[=+\-@]/.test(trimmedStart) || /^[=+\-@]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

export function asExcelCellValue(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return asExcelText(value);
}
