"use client";

import { useMemo, useState } from "react";
import type { ParseResult, ParsedRow } from "@/lib/parse";
import { normalizePhone } from "@/lib/phone";
import { fillTemplate, QR_TYPES } from "@/lib/qrTypes";
import { AlertIcon, ArrowIcon, CheckIcon, GlobeIcon } from "./icons";

interface Props {
  typeId: "vcard" | "id";
  parsed: ParseResult;
  onBack: () => void;
  onStart: (rows: ParsedRow[]) => void;
  starting: boolean;
  autoSave: boolean;
  onAutoSaveChange: (value: boolean) => void;
}

export default function ReviewStep({
  typeId, parsed, onBack, onStart, starting, autoSave, onAutoSaveChange,
}: Props) {
  const type = QR_TYPES[typeId];
  const [skipErrors, setSkipErrors] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const withErrors = useMemo(
    () => parsed.rows.filter((r) => r.issues.some((i) => i.level === "error")),
    [parsed.rows],
  );
  const withWarnings = useMemo(
    () => parsed.rows.filter(
      (r) => r.issues.length && !r.issues.some((i) => i.level === "error"),
    ),
    [parsed.rows],
  );
  const clean = parsed.rows.length - withErrors.length - withWarnings.length;

  const toRun = skipErrors
    ? parsed.rows.filter((r) => !r.issues.some((i) => i.level === "error"))
    : parsed.rows;

  const sample = parsed.rows[0];
  const flagged = showAll ? parsed.rows : [...withErrors, ...withWarnings];

  return (
    <>
      <div className="between" style={{ marginBottom: 22, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Review before generating</h1>
          <p className="ink2 small">
            {parsed.rows.length} rows · {type.name} · from{" "}
            <span className="mono">{parsed.fileName}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <span className="chip ok"><CheckIcon size={12} />{clean} ready</span>
          {withWarnings.length > 0 && (
            <span className="chip warn"><AlertIcon size={12} />{withWarnings.length} warnings</span>
          )}
          {withErrors.length > 0 && (
            <span className="chip danger"><AlertIcon size={12} />{withErrors.length} errors</span>
          )}
        </div>
      </div>

      <div className="split-left">
        <div className="stack">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>Applied to every row</div>
            {type.fixed.map((entry) => (
              <div
                key={entry.label}
                style={{
                  padding: "10px 0", borderBottom: "1px solid var(--line-2)",
                  display: entry.value.length > 34 ? "block" : "flex",
                  justifyContent: "space-between", gap: 16, alignItems: "center",
                }}
              >
                <span className="small muted">{entry.label}</span>
                <span
                  className="mono"
                  style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, display: "block" }}
                >
                  {entry.value}
                </span>
              </div>
            ))}
            <div className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
              <span className="small muted">QR colour</span>
              <span className="row" style={{ gap: 8 }}>
                <span
                  style={{
                    width: 18, height: 18, borderRadius: 5, background: type.color,
                    border: "1px solid rgba(0,0,0,.12)",
                  }}
                />
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{type.color}</span>
              </span>
            </div>
            <div className="between" style={{ padding: "10px 0" }}>
              <span className="small muted">Template</span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                No. {type.themeValue}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Naming &amp; formatting</div>
            <div className="small muted" style={{ marginBottom: 6 }}>QR name in the dashboard</div>
            <div
              className="mono"
              style={{
                fontSize: 12, color: "var(--accent-dark)", background: "var(--accent-tint)",
                borderRadius: 6, padding: "8px 10px",
              }}
            >
              {type.qrNameTemplate}
            </div>
            {sample && (
              <div className="tiny muted" style={{ marginTop: 6 }}>
                e.g.{" "}
                <span className="mono ink2">
                  {fillTemplate(type.qrNameTemplate, sample.values as unknown as Record<string, string>)}
                </span>
              </div>
            )}

            <div className="small muted" style={{ margin: "16px 0 6px" }}>Downloaded file</div>
            <div
              className="mono"
              style={{
                fontSize: 12, color: "var(--accent-dark)", background: "var(--accent-tint)",
                borderRadius: 6, padding: "8px 10px",
              }}
            >
              {type.fileNameTemplate}.png
            </div>

            <div style={{ borderTop: "1px solid var(--line-2)", marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Phone rule</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                A leading 0 gets +2, otherwise +20
              </div>
              {sample?.values.mobile && (
                <div className="row mono tiny" style={{ marginTop: 10, gap: 8 }}>
                  <span>{sample.values.mobile}</span>
                  <span className="muted">→</span>
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {normalizePhone(sample.values.mobile)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card tight">
            <div
              className="between"
              style={{ padding: "2px 16px 14px", borderBottom: "1px solid var(--line)" }}
            >
              <span className="card-title">
                {showAll ? "Every row" : "Rows that need a look"}
              </span>
              <span className="small muted">{flagged.length} of {parsed.rows.length}</span>
            </div>

            {flagged.length === 0 && (
              <div className="row" style={{ padding: "16px" }}>
                <span style={{ color: "var(--ok)", display: "flex" }}><CheckIcon size={16} /></span>
                <span className="small">Nothing to fix — every row is ready.</span>
              </div>
            )}

            {flagged.slice(0, 40).map((row) => {
              const worst = row.issues.some((i) => i.level === "error") ? "error" : "warning";
              const colour = worst === "error" ? "danger" : "warn";
              return (
                <div
                  key={row.rowNumber}
                  style={{
                    display: "flex", gap: 13, padding: "14px 16px",
                    borderBottom: "1px solid var(--line-2)", alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: row.issues.length ? `var(--${colour})` : "var(--ok)",
                      display: "flex", marginTop: 1,
                    }}
                  >
                    {row.issues.length ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 9 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                        {row.values.displayName || <span className="muted">no name</span>}
                      </span>
                      <span className="mono tiny muted">{row.values.code}</span>
                      {row.issues.length > 0 && (
                        <span className={`chip ${colour}`}>
                          {worst === "error" ? "Error" : "Warning"}
                        </span>
                      )}
                    </div>
                    {row.issues.map((issue, index) => (
                      <div key={index} className="small ink2" style={{ marginTop: 3 }}>
                        {issue.message}
                      </div>
                    ))}
                  </div>
                  <span className="tiny muted">row {row.rowNumber}</span>
                </div>
              );
            })}

            {!showAll && clean > 0 && (
              <div className="row" style={{ padding: "14px 16px" }}>
                <span style={{ color: "var(--ok)", display: "flex" }}><CheckIcon size={16} /></span>
                <span className="small ink2">{clean} rows have no issues</span>
                <button
                  className="btn ghost"
                  style={{ marginLeft: "auto", height: 28 }}
                  onClick={() => setShowAll(true)}
                >
                  Show all
                </button>
              </div>
            )}
          </div>

          <div className="banner info" style={{ marginTop: 18 }}>
            <span style={{ color: "var(--accent-dark)", display: "flex", marginTop: 1 }}>
              <GlobeIcon size={17} />
            </span>
            <div className="small" style={{ color: "var(--accent-dark)", lineHeight: 1.6 }}>
              <strong>What happens next.</strong> One person at a time: the server fills
              every field, applies the template and the STM colour, names the code and
              sends the image back here, where your browser saves it. You can pause or
              stop between people.
            </div>
          </div>

          <label
            className="card"
            style={{
              marginTop: 18, display: "flex", gap: 12,
              alignItems: "flex-start", cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(event) => onAutoSaveChange(event.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--accent)" }}
            />
            <span>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                Save each QR as it finishes
              </span>
              <span
                className="small ink2"
                style={{ display: "block", marginTop: 3, lineHeight: 1.55 }}
              >
                Each image goes straight to your Downloads folder. Your browser may ask
                once whether to allow several downloads from this site — say yes. Turn
                this off to collect them and take a single ZIP at the end instead.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="footerbar">
        <div className="wrap">
          <label className="row small ink2" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={skipErrors}
              onChange={(event) => setSkipErrors(event.target.checked)}
              style={{ width: 15, height: 15, accentColor: "var(--accent)" }}
            />
            Skip the {withErrors.length} row{withErrors.length === 1 ? "" : "s"} with errors
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={onBack}>Back</button>
            <button
              className="btn primary"
              disabled={starting || toRun.length === 0}
              onClick={() => onStart(toRun)}
            >
              {starting ? "Opening the browser…" : `Generate ${toRun.length} QR codes`}
              <ArrowIcon size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
