import Link from "next/link";
import { ReactNode } from "react";
import { CheckIcon, QrGlyph } from "./icons";

export function TopBar({ active }: { active?: "Batches" | "History" | "Settings" }) {
  const link = (label: "Batches" | "History" | "Settings", href: string) => (
    <Link
      href={href}
      style={{
        fontSize: 13.5,
        fontWeight: active === label ? 500 : 400,
        color: active === label ? "var(--ink)" : "var(--ink-2)",
        padding: "6px 2px",
        borderBottom: `2px solid ${active === label ? "var(--accent)" : "transparent"}`,
      }}
    >
      {label}
    </Link>
  );

  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="brand" style={{ color: "inherit" }}>
          <span className="brand-mark"><QrGlyph color="#fff" /></span>
          <span className="brand-name">QR Studio</span>
          <span className="brand-div" />
          <span className="tag mono">STM</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {link("Batches", "/")}
          {link("History", "/history")}
          <span className="avatar">MT</span>
        </div>
      </div>
    </header>
  );
}

const STEP_NAMES = ["Upload sheet", "Review", "Generate", "Results"];

export function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="stepper">
      <div className="wrap">
        {STEP_NAMES.map((name, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "now" : "";
          return (
            <div key={name} style={{ display: "contents" }}>
              <div className={`step ${state}`}>
                <span className="step-dot">
                  {number < step ? <CheckIcon size={12} /> : number}
                </span>
                <span className="step-label">{name}</span>
              </div>
              {number < STEP_NAMES.length && <span className="step-line" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="shell">{children}</div>;
}
