import fs from "node:fs";
import path from "node:path";

export type RowStatus = "queued" | "running" | "done" | "failed" | "skipped";

export interface RunRow {
  rowNumber: number;
  code: string;
  displayName: string;
  qrName: string;
  status: RowStatus;
  detail: string;
  file: string | null;
  seconds: number | null;
}

export interface RunState {
  id: string;
  type: "vcard" | "id";
  fileName: string;
  outputDir: string;
  startedAt: number;
  finishedAt: number | null;
  status: "starting" | "signin" | "running" | "paused" | "stopping" | "done" | "error";
  message: string;
  rows: RunRow[];
  log: { at: number; text: string }[];
  control: { paused: boolean; stopped: boolean };
}

type Listener = (run: RunState) => void;

const runs = new Map<string, RunState>();
const listeners = new Map<string, Set<Listener>>();

export const HISTORY_PATH = path.join(process.cwd(), "runs.json");

export function createRun(run: RunState): RunState {
  runs.set(run.id, run);
  return run;
}

export function getRun(id: string): RunState | undefined {
  return runs.get(id);
}

export function subscribe(id: string, listener: Listener): () => void {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id)!.add(listener);
  return () => listeners.get(id)?.delete(listener);
}

export function emit(id: string): void {
  const run = runs.get(id);
  if (!run) return;
  for (const listener of listeners.get(id) ?? []) {
    try { listener(run); } catch { /* a dropped client is not our problem */ }
  }
}

export function log(id: string, text: string): void {
  const run = runs.get(id);
  if (!run) return;
  run.log.push({ at: Date.now(), text });
  if (run.log.length > 400) run.log.splice(0, run.log.length - 400);
  emit(id);
}

export interface HistoryEntry {
  id: string;
  type: string;
  fileName: string;
  rows: number;
  created: number;
  failed: number;
  finishedAt: number;
  outputDir: string;
}

export function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry): void {
  const all = readHistory();
  all.unshift(entry);
  try {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(all.slice(0, 100), null, 2), "utf8");
  } catch { /* history is a nicety, never fail a run over it */ }
}
