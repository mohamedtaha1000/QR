"use client";

import { useEffect, useState } from "react";
import { readHistory, type HistoryEntry } from "@/lib/runTypes";

function when(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export default function RecentBatches({ limit = 3 }: { limit?: number }) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  // localStorage only exists in the browser, so read it after mounting.
  useEffect(() => setHistory(readHistory().slice(0, limit)), [limit]);

  if (!history || history.length === 0) return null;

  return (
    <div style={{ marginTop: 34 }}>
      <div className="eyebrow">Recent batches</div>
      <div className="card tight">
        <table>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td style={{ fontWeight: 500 }}>{entry.fileName}</td>
                <td><span className="chip accent">{entry.type}</span></td>
                <td className="mono muted">{entry.created} QRs</td>
                <td className="muted small" style={{ textAlign: "right" }}>
                  {when(entry.finishedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
