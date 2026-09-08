"use client";

import { useEffect, useState } from "react";
import { Page, TopBar } from "@/components/Shell";
import { readHistory, type HistoryEntry } from "@/lib/runTypes";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => setHistory(readHistory()), []);

  return (
    <Page>
      <TopBar active="History" />
      <main className="main">
        <div className="wrap">
          <h1>Run history</h1>
          <p className="ink2 small" style={{ marginBottom: 24 }}>
            Kept in this browser, on this machine — it is not shared with anyone else.
          </p>

          {!history || history.length === 0 ? (
            <div className="card">
              <p className="ink2 small">No batches yet.</p>
            </div>
          ) : (
            <div className="card tight">
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Source file</th>
                      <th>Type</th>
                      <th>Rows</th>
                      <th>Created</th>
                      <th>Failed</th>
                      <th style={{ textAlign: "right" }}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ fontWeight: 500 }}>{entry.fileName}</td>
                        <td><span className="chip accent">{entry.type}</span></td>
                        <td className="mono ink2">{entry.rows}</td>
                        <td className="mono" style={{ color: "var(--ok)", fontWeight: 500 }}>
                          {entry.created}
                        </td>
                        <td
                          className="mono"
                          style={{
                            color: entry.failed ? "var(--danger)" : "var(--muted)",
                            fontWeight: entry.failed ? 500 : 400,
                          }}
                        >
                          {entry.failed}
                        </td>
                        <td className="small muted" style={{ textAlign: "right" }}>
                          {new Date(entry.finishedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </Page>
  );
}
