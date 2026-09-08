"use client";

import { useRef, useState } from "react";
import type { ParseResult } from "@/lib/parse";
import { ArrowIcon, CheckIcon, FileIcon, UploadIcon, XIcon } from "./icons";

interface Props {
  typeId: "vcard" | "id";
  parsed: ParseResult | null;
  file: File | null;
  onParsed: (file: File, result: ParseResult) => void;
  onNext: () => void;
}

const PREVIEW_COLUMNS = ["no", "code", "displayName", "mobile", "jobTitle", "email"] as const;

export default function UploadStep({ typeId, parsed, file, onParsed, onNext }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(next: File, sheet?: string) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", next);
    form.append("type", typeId);
    if (sheet) form.append("sheet", sheet);
    try {
      const response = await fetch("/api/parse", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not read that file.");
      onParsed(next, data as ParseResult);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 22, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24 }}>New {typeId === "vcard" ? "vCard" : "ID"} batch</h1>
          <p className="ink2 small">Upload the staff sheet you want QR codes for.</p>
        </div>
      </div>

      <div className="split">
        <div>
          {!parsed ? (
            <div
              className={`dropzone ${over ? "over" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) void send(dropped);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xlsm,.csv"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  if (picked) void send(picked);
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <UploadIcon size={26} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {busy ? "Reading the sheet…" : "Drop your Excel or CSV here"}
                </div>
                <div className="small ink2">or click to browse — .xlsx, .xlsm or .csv</div>
              </div>
            </div>
          ) : (
            <div className="dropzone" style={{ padding: 16, cursor: "default" }}>
              <div className="filecard">
                <span
                  className="icon-tile"
                  style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
                >
                  <FileIcon size={19} />
                </span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{parsed.fileName}</div>
                  <div className="muted tiny" style={{ marginTop: 3 }}>
                    {file ? `${Math.round(file.size / 1024)} KB · ` : ""}
                    {parsed.rows.length} rows · read from “{parsed.sheet}”
                  </div>
                </div>
                {parsed.sheetNames.length > 1 && (
                  <select
                    value={parsed.sheet}
                    onChange={(event) => file && void send(file, event.target.value)}
                  >
                    {parsed.sheetNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
                <button className="btn" onClick={() => inputRef.current?.click()}>
                  Replace
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.csv"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    if (picked) void send(picked);
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="banner danger" style={{ marginTop: 16 }}>
              <span style={{ color: "var(--danger)" }}><XIcon size={17} /></span>
              <div className="small">{error}</div>
            </div>
          )}

          {parsed && (
            <>
              <div className="between" style={{ marginTop: 22, alignItems: "baseline" }}>
                <div className="eyebrow" style={{ marginBottom: 0 }}>Sheet preview</div>
                <span className="tiny muted">
                  First {Math.min(8, parsed.rows.length)} of {parsed.rows.length} rows
                </span>
              </div>
              <div className="card tight" style={{ marginTop: 12 }}>
                <div className="scroll-x">
                  <table>
                    <thead>
                      <tr>
                        {PREVIEW_COLUMNS.map((key) => (
                          <th key={key}>
                            {parsed.mapping.find((m) => m.key === key)?.label ?? key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 8).map((row) => (
                        <tr key={row.rowNumber}>
                          {PREVIEW_COLUMNS.map((key) => (
                            <td
                              key={key}
                              className={["no", "code", "mobile"].includes(key) ? "mono ink2" : ""}
                              style={key === "displayName" ? { fontWeight: 500 } : undefined}
                            >
                              {row.values[key] || <span className="muted">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="card">
            <div className="between" style={{ marginBottom: 4 }}>
              <span className="card-title">Column mapping</span>
              {parsed && (
                <span className="chip ok">
                  <CheckIcon size={12} />
                  {parsed.mapping.filter((m) => m.column).length} of {parsed.mapping.length}
                </span>
              )}
            </div>
            <p className="small ink2" style={{ margin: "6px 0 10px" }}>
              {parsed
                ? "Headers were matched automatically."
                : "Upload a sheet and the columns are matched here."}
            </p>
            {(parsed?.mapping ?? []).map((entry) => (
              <div
                key={entry.key}
                className="row"
                style={{ padding: "9px 0", borderBottom: "1px solid var(--line-2)" }}
              >
                <span style={{ color: entry.column ? "var(--ok)" : "var(--muted)", display: "flex" }}>
                  {entry.column ? <CheckIcon size={14} /> : <XIcon size={14} />}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{entry.label}</span>
                <span
                  className="mono tag"
                  style={{ color: entry.column ? "var(--ink)" : "var(--muted)" }}
                >
                  {entry.column ? `Column ${entry.column}` : "Not mapped"}
                </span>
              </div>
            ))}
            <div
              className="small ink2"
              style={{
                marginTop: 14, background: "var(--bg)", borderRadius: 8,
                padding: 12, lineHeight: 1.55,
              }}
            >
              All seven columns must be present in the header row. Empty cells are
              fine except the name — mobile numbers are normalised to{" "}
              <span className="mono tiny">+20…</span> whichever way Excel stored them.
            </div>
          </div>
        </div>
      </div>

      <div className="footerbar">
        <div className="wrap">
          <span className="small ink2">
            {parsed ? `${parsed.rows.length} rows detected` : "No sheet yet"}
          </span>
          <button className="btn primary" disabled={!parsed} onClick={onNext}>
            Continue to review <ArrowIcon size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
