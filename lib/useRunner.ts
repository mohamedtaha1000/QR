"use client";

import { useCallback, useRef, useState } from "react";
import type { ParsedRow } from "./parse";
import { fillTemplate, QR_TYPES } from "./qrTypes";
import type { GenerateResponse, RunRow } from "./runTypes";
import { saveHistory } from "./runTypes";

export type RunStatus = "idle" | "signin" | "running" | "paused" | "stopping" | "done";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Hand the file to the browser, the same as clicking any download link. */
function saveToDownloads(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

export function useRunner(typeId: "vcard" | "id") {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [rows, setRows] = useState<RunRow[]>([]);
  const [log, setLog] = useState<{ at: number; text: string }[]>([]);
  const [message, setMessage] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [sourceName, setSourceName] = useState("");

  /** QR Tiger session cookies. Memory only — never written to storage. */
  const session = useRef<unknown | null>(null);
  const paused = useRef(false);
  const stopped = useRef(false);

  const note = useCallback((text: string) => {
    setLog((all) => [...all.slice(-80), { at: Date.now(), text }]);
  }, []);

  const patch = useCallback((rowNumber: number, change: Partial<RunRow>) => {
    setRows((all) =>
      all.map((row) => (row.rowNumber === rowNumber ? { ...row, ...change } : row)),
    );
  }, []);

  const getSession = useCallback(
    async (mode: "auto" | "manual"): Promise<boolean> => {
      setStatus("signin");
      setMessage(
        mode === "auto"
          ? "Signing in to QR Tiger…"
          : "A browser window is open — sign in there, then it carries on.",
      );
      note(mode === "auto" ? "Signing in with the saved credentials" : "Waiting for sign-in");
      try {
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = await response.json();
        if (!data.ok) {
          setMessage(data.error ?? "Sign-in failed.");
          note(`Sign-in failed: ${data.error ?? "unknown"}`);
          return false;
        }
        session.current = data.session;
        note("Signed in");
        return true;
      } catch {
        setMessage("Could not reach the server to sign in.");
        return false;
      }
    },
    [note],
  );

  const start = useCallback(
    async (parsedRows: ParsedRow[], fileName: string) => {
      const type = QR_TYPES[typeId];
      paused.current = false;
      stopped.current = false;
      session.current = null;
      setSourceName(fileName);
      setStartedAt(Date.now());
      setFinishedAt(null);
      setLog([]);
      setMessage("");
      setRows(
        parsedRows.map((row) => ({
          rowNumber: row.rowNumber,
          code: row.values.code,
          displayName: row.values.displayName,
          qrName: fillTemplate(
            type.qrNameTemplate,
            row.values as unknown as Record<string, string>,
          ),
          status: "queued",
          detail: "Queued",
          fileName: null,
          bytes: null,
          seconds: null,
        })),
      );

      if (!(await getSession("auto"))) {
        if (!(await getSession("manual"))) {
          setStatus("done");
          setFinishedAt(Date.now());
          return;
        }
      }

      setStatus("running");
      setMessage("");

      let created = 0;
      let failed = 0;

      for (const row of parsedRows) {
        if (stopped.current) break;
        while (paused.current && !stopped.current) {
          setStatus("paused");
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        if (stopped.current) break;
        setStatus("running");

        patch(row.rowNumber, { status: "running", detail: "Filling the form…" });
        const began = Date.now();

        let data: GenerateResponse | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: typeId,
              values: row.values,
              session: session.current,
            }),
          });
          data = (await response.json()) as GenerateResponse;

          if (data.ok) break;
          if (data.needsSession && attempt === 0) {
            note("The session expired — signing in again");
            if (!(await getSession("auto"))) break;
            setStatus("running");
            continue;
          }
          break;
        }

        const seconds = Math.round((Date.now() - began) / 100) / 10;

        if (data?.ok && data.image && data.fileName) {
          const bytes = base64ToBytes(data.image);
          if (autoSave) saveToDownloads(bytes, data.fileName, data.mimeType ?? "image/png");
          patch(row.rowNumber, {
            status: "done",
            detail: autoSave ? "Downloaded" : "Ready to save",
            fileName: data.fileName,
            bytes,
            seconds,
          });
          note(`${row.values.displayName} — ${data.fileName}`);
          created += 1;
        } else {
          patch(row.rowNumber, {
            status: "failed",
            detail: data?.error ?? "Failed",
            seconds,
          });
          note(`${row.values.displayName} — failed: ${data?.error ?? "unknown"}`);
          failed += 1;
        }
      }

      setRows((all) =>
        all.map((row) =>
          row.status === "queued" || row.status === "running"
            ? { ...row, status: "skipped", detail: "Stopped before this row" }
            : row,
        ),
      );
      setStatus("done");
      const ended = Date.now();
      setFinishedAt(ended);
      saveHistory({
        id: `run_${ended.toString(36)}`,
        type: typeId,
        fileName,
        rows: parsedRows.length,
        created,
        failed,
        finishedAt: ended,
      });
    },
    [autoSave, getSession, note, patch, typeId],
  );

  const pause = useCallback(() => { paused.current = true; }, []);
  const resume = useCallback(() => { paused.current = false; setStatus("running"); }, []);
  const stop = useCallback(() => {
    stopped.current = true;
    paused.current = false;
    setStatus("stopping");
  }, []);

  const saveOne = useCallback((row: RunRow) => {
    if (row.bytes && row.fileName) saveToDownloads(row.bytes, row.fileName, "image/png");
  }, []);

  const saveZip = useCallback(async () => {
    const withBytes = rows.filter((row) => row.bytes && row.fileName);
    if (withBytes.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const row of withBytes) zip.file(row.fileName!, row.bytes!);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${typeId}-qr-${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  }, [rows, typeId]);

  const reset = useCallback(() => {
    session.current = null;
    setRows([]);
    setLog([]);
    setStatus("idle");
    setStartedAt(null);
    setFinishedAt(null);
    setMessage("");
  }, []);

  return {
    status, rows, log, message, startedAt, finishedAt, sourceName,
    autoSave, setAutoSave,
    start, pause, resume, stop, saveOne, saveZip, reset,
    signInByHand: () => getSession("manual"),
  };
}
