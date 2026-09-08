import Link from "next/link";
import { Page, TopBar } from "@/components/Shell";
import { ArrowIcon, BadgeIcon, CardIcon, PenIcon } from "@/components/icons";
import { QR_TYPES } from "@/lib/qrTypes";
import RecentBatches from "@/components/RecentBatches";

export default function Home() {
  return (
    <Page>
      <TopBar active="Batches" />
      <main className="main">
        <div className="wrap">
          <div style={{ marginBottom: 26 }}>
            <h1>Start a new batch</h1>
            <p className="ink2" style={{ maxWidth: "62ch", fontSize: 14.5 }}>
              Upload one sheet. QR Studio fills the generator for every row, names each
              code and brings the images back to you.
            </p>
          </div>

          <div className="grid-2">
            {(["vcard", "id"] as const).map((id) => {
              const type = QR_TYPES[id];
              const Icon = id === "vcard" ? CardIcon : BadgeIcon;
              return (
                <div
                  key={id}
                  className="card"
                  style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18 }}
                >
                  <div className="row">
                    <span
                      className="icon-tile"
                      style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: type.ready ? "var(--accent-tint)" : "var(--bg)",
                        color: type.ready ? "var(--accent)" : "var(--ink-2)",
                      }}
                    >
                      <Icon size={22} />
                    </span>
                    <h2>{type.name}</h2>
                    {!type.ready && (
                      <span className="chip warn" style={{ marginLeft: "auto" }}>
                        Not configured
                      </span>
                    )}
                  </div>

                  <p className="ink2 small" style={{ maxWidth: "42ch" }}>{type.blurb}</p>

                  <div
                    style={{
                      display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                      gap: 14, padding: "16px 0",
                      borderTop: "1px solid var(--line-2)",
                      borderBottom: "1px solid var(--line-2)",
                    }}
                  >
                    {[
                      ["Source", `${type.columns.length} columns`],
                      ["Template", type.ready ? `No. ${type.themeValue}` : "TBD"],
                      ["Output", "PNG"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span className="tiny muted">{label}</span>
                        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {type.ready ? (
                    <Link href={`/batch?type=${id}`} className="btn primary" style={{ width: "fit-content" }}>
                      Start {type.name} batch <ArrowIcon size={15} />
                    </Link>
                  ) : (
                    <button className="btn" disabled style={{ width: "fit-content" }}>
                      <PenIcon size={15} /> Define ID rules
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <RecentBatches />
        </div>
      </main>
    </Page>
  );
}
