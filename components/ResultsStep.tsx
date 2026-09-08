"use client";

import { useMemo } from "react";
import type { RunRow } from "@/lib/runTypes";
import { AlertIcon, DownloadIcon, FileIcon, RefreshIcon } from "./icons";

interface Props {
  rows: RunRow[];
  sourceName: string;
  startedAt: number | null;
  finishedAt: number | null;
  onSaveOne: (row: RunRow) => void;
  onSaveZip: () => void;
  onNewBatch: () => void;
}

export default function ResultsStep(props: Props) {
  const { rows, sourceName, startedAt, finishedAt } = props;
  const done = rows.filter((r) => r.status === "done");
  const failed = rows.filter((r) => r.status === "failed");
  const skipped = rows.filter((r) => r.status === "skipped");
  const seconds = Math.round(((finishedAt ?? Date.now()) - (startedAt ?? Date.now())) / 1000);

  const previews = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of rows) {
      if (row.bytes) {
        map.set(
          row.rowNumber,
          URL.createObjectURL(new Blob([row.bytes as BlobPart], { type: "image/png" })),
        );
      }
    }
    return map;
  }, [rows]);

  const csv = [
    ["row", "code", "name", "qr name", "status", "detail", "file"].join(","),
    ...rows.map((r) =>
      [r.rowNumber, r.code, r.displayName, r.qrName, r.status, r.detail, r.fileName ?? ""]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  return (
    <>
      <div className="between" style={{ alignItems: "flex-start", marginBottom: 24, gap: 24 }}>
        <div>
          <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
            <h1>{done.length} of {rows.length} created</h1>
            {failed.length > 0 && (
              <span className="chip danger"><AlertIcon size={12} />{failed.length} failed</span>
            )}
            {skipped.length > 0 && <span className="chip mutedchip">{skipped.length} skipped</span>}
          </div>
          <p className="ink2 small" style={{ marginTop: 7 }}>
            From <span className="mono">{sourceName}</span> · finished in{" "}
            {Math.floor(seconds / 60)} min {seconds % 60} s · saved to your Downloads folder
          </p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn" onClick={props.onNewBatch}>
            <RefreshIcon size={15} /> New batch
          </button>
          <a className="btn" href={csvHref} download="qr-run-log.csv">
            <FileIcon size={15} /> Export log
          </a>
          <button className="btn primary" onClick={props.onSaveZip} disabled={done.length === 0}>
            <DownloadIcon size={15} /> Download all as ZIP
          </button>
        </div>
      </div>

      <div className="tiles">
        {rows
          .filter((r) => r.status === "done" || r.status === "failed")
          .map((row) => (
            <div key={row.rowNumber} className="tile">
              <div
                className="art"
                style={row.status === "failed" ? { background: "var(--danger-tint)" } : undefined}
              >
                {row.status === "done" && previews.get(row.rowNumber) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews.get(row.rowNumber)} alt={row.qrName} />
                ) : (
                  <div
                    style={{
                      color: "var(--danger)", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 7, padding: 10, textAlign: "center",
                    }}
                  >
                    <AlertIcon size={22} />
                    <span className="tiny" style={{ lineHeight: 1.4 }}>{row.detail}</span>
                  </div>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {row.displayName}
                </div>
                <div className="mono tiny muted">{row.code}</div>
              </div>
              <div className="between" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 9 }}>
                <span className="tiny muted">{row.status === "done" ? "vCard" : "Failed"}</span>
                {row.status === "done" && (
                  <button
                    className="btn ghost"
                    style={{ height: 22, padding: 0, fontSize: 12, color: "var(--accent)" }}
                    onClick={() => props.onSaveOne(row)}
                  >
                    <DownloadIcon size={13} /> Save
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
