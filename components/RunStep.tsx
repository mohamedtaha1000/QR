"use client";

import type { RunRow } from "@/lib/runTypes";
import type { RunStatus } from "@/lib/useRunner";
import {
  AlertIcon, CheckIcon, DownloadIcon, LockIcon, PauseIcon, PlayIcon, StopIcon,
} from "./icons";

interface Props {
  status: RunStatus;
  rows: RunRow[];
  log: { at: number; text: string }[];
  message: string;
  startedAt: number | null;
  finishedAt: number | null;
  autoSave: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onFinished: () => void;
}

function clock(from: number | null, to: number | null): string {
  if (!from) return "00:00";
  const seconds = Math.round(((to ?? Date.now()) - from) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function RunStep(props: Props) {
  const { status, rows, log, message, startedAt, finishedAt, autoSave } = props;
  const done = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const total = rows.length || 1;
  const settled = done + failed;
  const finished = status === "done";
  const perRow = settled > 0 && startedAt ? (Date.now() - startedAt) / settled : 0;
  const eta = perRow > 0 ? Math.round(((total - settled) * perRow) / 60000) : null;

  return (
    <>
      {status === "signin" && (
        <div className="banner warn" style={{ marginBottom: 20 }}>
          <span style={{ color: "var(--warn)", display: "flex", marginTop: 1 }}>
            <LockIcon size={18} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--warn)" }}>
              Signing in to QR Tiger
            </div>
            <div className="small ink2" style={{ marginTop: 4, lineHeight: 1.6, maxWidth: "60ch" }}>
              {message || "One moment."}
            </div>
          </div>
        </div>
      )}

      {finished && message && (
        <div className="banner danger" style={{ marginBottom: 20 }}>
          <span style={{ color: "var(--danger)", display: "flex", marginTop: 1 }}>
            <AlertIcon size={18} />
          </span>
          <div className="small">{message}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="between" style={{ alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>
              {autoSave
                ? "Generating and saving to your Downloads folder"
                : "Generating — save them from the Results step"}
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 9 }}>
              <span className="big-number">{settled}</span>
              <span className="muted" style={{ fontSize: 16 }}>of {rows.length}</span>
              <span className={`chip ${finished ? "ok" : status === "paused" ? "warn" : "accent"}`}>
                {finished ? "Finished" : status === "paused" ? "Paused" : status === "stopping" ? "Stopping" : "Running"}
              </span>
            </div>
          </div>
          <div className="row" style={{ gap: 22 }}>
            <div style={{ textAlign: "right" }}>
              <div className="tiny muted">Elapsed</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>
                {clock(startedAt, finishedAt)}
              </div>
            </div>
            {!finished && eta !== null && (
              <div style={{ textAlign: "right" }}>
                <div className="tiny muted">Remaining</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>~{eta} min</div>
              </div>
            )}
            {!finished ? (
              <div style={{ display: "flex", gap: 9 }}>
                {status === "paused" ? (
                  <button className="btn" onClick={props.onResume}>
                    <PlayIcon size={15} /> Resume
                  </button>
                ) : (
                  <button className="btn" onClick={props.onPause} disabled={status === "signin"}>
                    <PauseIcon size={15} /> Pause
                  </button>
                )}
                <button className="btn danger" onClick={props.onStop}>
                  <StopIcon size={15} /> Stop
                </button>
              </div>
            ) : (
              <button className="btn primary" onClick={props.onFinished}>
                See results <DownloadIcon size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="bar">
          <div className="done-part" style={{ width: `${(done / total) * 100}%` }} />
          <div className="fail-part" style={{ width: `${(failed / total) * 100}%` }} />
        </div>
        <div className="row" style={{ gap: 18, marginTop: 11 }}>
          <span className="row small ink2" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)" }} />
            {done} done
          </span>
          <span className="row small ink2" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--danger)" }} />
            {failed} failed
          </span>
          <span className="row small muted" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--line)" }} />
            {rows.length - settled} queued
          </span>
        </div>
      </div>

      <div className="split">
        <div className="card tight">
          <div
            className="between"
            style={{ padding: "2px 16px 13px", borderBottom: "1px solid var(--line)" }}
          >
            <span className="card-title">People in this batch</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {rows.map((row) => (
              <div key={row.rowNumber} className={`runrow ${row.status === "running" ? "live" : ""}`}>
                {row.status === "done" && (
                  <span style={{ color: "var(--ok)", display: "flex" }}><CheckIcon size={15} /></span>
                )}
                {row.status === "failed" && (
                  <span style={{ color: "var(--danger)", display: "flex" }}><AlertIcon size={15} /></span>
                )}
                {row.status === "running" && <span className="spinner" />}
                {(row.status === "queued" || row.status === "skipped") && (
                  <span
                    style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: "var(--line)", margin: 3, flex: "none",
                    }}
                  />
                )}
                <span
                  className="who"
                  style={{
                    fontWeight: row.status === "running" || row.status === "failed" ? 500 : 400,
                    color: row.status === "queued" ? "var(--muted)" : "var(--ink)",
                  }}
                >
                  {row.displayName}
                </span>
                <span className="mono tiny muted">{row.code}</span>
                <span
                  className="small"
                  style={{
                    flex: 1,
                    color:
                      row.status === "failed" ? "var(--danger)"
                        : row.status === "running" ? "var(--accent-dark)"
                          : "var(--ink-2)",
                  }}
                >
                  {row.detail}
                </span>
                {row.seconds !== null && <span className="mono tiny muted">{row.seconds}s</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-title" style={{ marginBottom: 11 }}>Activity</div>
          {[...log].reverse().slice(0, 14).map((entry, index) => (
            <div key={index} className="row mono" style={{ gap: 10, fontSize: 11, lineHeight: 1.9 }}>
              <span className="muted">
                {new Date(entry.at).toLocaleTimeString([], {
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
              <span className="ink2">{entry.text}</span>
            </div>
          ))}
          {log.length === 0 && <div className="small muted">Nothing yet.</div>}
        </div>
      </div>
    </>
  );
}
