/**
 * Types shared between the client runner and the API. Deliberately free of
 * any Node import so client components can use them.
 */
import type { FieldKey } from "./qrTypes";

export type RowStatus = "queued" | "running" | "done" | "failed" | "skipped";

export interface RunRow {
  rowNumber: number;
  code: string;
  displayName: string;
  qrName: string;
  status: RowStatus;
  detail: string;
  fileName: string | null;
  /** Kept only so "Download all" can zip them without asking the server again. */
  bytes: Uint8Array | null;
  seconds: number | null;
}

export interface GenerateRequest {
  type: "vcard" | "id";
  values: Record<FieldKey, string>;
  /** Playwright storageState from a previous sign-in. Memory only, never stored. */
  session: unknown | null;
}

export interface GenerateResponse {
  ok: boolean;
  /** Set when the account needs signing in again. */
  needsSession?: boolean;
  error?: string;
  fileName?: string;
  mimeType?: string;
  /** base64 image body */
  image?: string;
  qrName?: string;
}

export interface HistoryEntry {
  id: string;
  type: string;
  fileName: string;
  rows: number;
  created: number;
  failed: number;
  finishedAt: number;
}

export const HISTORY_KEY = "qrstudio.history";

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const all = [entry, ...readHistory()].slice(0, 50);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* a full or blocked localStorage must not break a finished run */
  }
}
