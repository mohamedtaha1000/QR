import ExcelJS from "exceljs";
import { ColumnSpec, FieldKey, QrTypeDef } from "./qrTypes";
import { normalizePhone } from "./phone";

export interface ParsedRow {
  rowNumber: number;
  values: Record<FieldKey, string>;
  issues: Issue[];
}

export interface Issue {
  level: "error" | "warning";
  message: string;
}

export interface ParseResult {
  fileName: string;
  sheetNames: string[];
  sheet: string;
  headers: string[];
  mapping: { key: FieldKey; label: string; column: string | null; required: boolean }[];
  rows: ParsedRow[];
  errorCount: number;
  warningCount: number;
}

const normalizeHeader = (text: unknown) =>
  String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const rich = value as { text?: string; result?: unknown; hyperlink?: string };
    if (typeof rich.text === "string") return rich.text.trim();
    if (rich.result !== undefined) return String(rich.result).trim();
  }
  return String(value).trim();
};

const columnLetter = (index: number): string => {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

async function readGrid(
  buffer: Buffer,
  fileName: string,
  wantedSheet?: string,
): Promise<{ grid: string[][]; sheetNames: string[]; sheet: string }> {
  if (/\.(csv|txt)$/i.test(fileName)) {
    const grid = parseCsv(buffer.toString("utf8").replace(/^﻿/, ""));
    return { grid, sheetNames: ["CSV"], sheet: "CSV" };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheetNames = workbook.worksheets.map((w) => w.name);
  const worksheet =
    (wantedSheet && workbook.getWorksheet(wantedSheet)) || workbook.worksheets[0];
  if (!worksheet) throw new Error("That workbook has no sheets.");

  const grid: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const line: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      line[colNumber - 1] = cellText(cell.value);
    });
    for (let i = 0; i < line.length; i += 1) line[i] = line[i] ?? "";
    if (line.some((c) => c !== "")) grid.push(line);
  });
  return { grid, sheetNames, sheet: worksheet.name };
}

/** Small RFC-4180-ish CSV reader — quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
  return rows;
}

function mapColumns(headers: string[], columns: ColumnSpec[]) {
  const normalized = headers.map(normalizeHeader);
  return columns.map((spec) => {
    let index = -1;
    for (const alias of spec.aliases) {
      const found = normalized.indexOf(normalizeHeader(alias));
      if (found !== -1) { index = found; break; }
    }
    return { spec, index };
  });
}

export async function parseSheet(
  buffer: Buffer,
  fileName: string,
  type: QrTypeDef,
  wantedSheet?: string,
): Promise<ParseResult> {
  const { grid, sheetNames, sheet } = await readGrid(buffer, fileName, wantedSheet);
  if (grid.length === 0) throw new Error("That sheet is empty.");

  const [headers, ...body] = grid;
  const mapped = mapColumns(headers, type.columns);

  const missing = mapped.filter((m) => m.spec.required && m.index === -1);
  if (missing.length) {
    throw new Error(
      `The sheet is missing ${missing.length === 1 ? "this column" : "these columns"}: ` +
        `${missing.map((m) => m.spec.label).join(", ")}. ` +
        `Headers found: ${headers.filter(Boolean).join(", ")}`,
    );
  }

  const rows: ParsedRow[] = [];
  let errorCount = 0;
  let warningCount = 0;

  body.forEach((line, offset) => {
    const values = {} as Record<FieldKey, string>;
    for (const { spec, index } of mapped) {
      values[spec.key] = index === -1 ? "" : (line[index] ?? "").trim();
    }
    if (!values.displayName && !values.code && !values.email) return; // spacer row

    const issues: Issue[] = [];
    for (const { spec } of mapped) {
      if (spec.valueRequired && !values[spec.key]) {
        issues.push({ level: "error", message: `${spec.label} is empty` });
      }
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      issues.push({ level: "warning", message: "Email does not look like an address" });
    }

    errorCount += issues.filter((i) => i.level === "error").length ? 1 : 0;
    warningCount += issues.length && !issues.some((i) => i.level === "error") ? 1 : 0;
    rows.push({ rowNumber: offset + 2, values, issues });
  });

  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = row.values.code.toLowerCase();
    if (!key) continue;
    const previous = seen.get(key);
    if (previous !== undefined) {
      row.issues.push({ level: "warning", message: `Code repeats row ${previous}` });
    } else seen.set(key, row.rowNumber);
  }

  return {
    fileName,
    sheetNames,
    sheet,
    headers,
    mapping: mapped.map(({ spec, index }) => ({
      key: spec.key,
      label: spec.label,
      column: index === -1 ? null : columnLetter(index),
      required: Boolean(spec.required),
    })),
    rows,
    errorCount,
    warningCount,
  };
}

export const previewPhone = normalizePhone;
