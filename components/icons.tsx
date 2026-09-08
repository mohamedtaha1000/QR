import { ReactNode } from "react";

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} style={{ display: "block" }}>
      {children}
    </svg>
  );
}

export const CardIcon = (p: { size?: number }) => (
  <Svg {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <circle cx="8" cy="11" r="2" />
    <path d="M5 16c.6-1.5 1.7-2 3-2s2.4.5 3 2M14 10h5M14 14h3" />
  </Svg>
);
export const BadgeIcon = (p: { size?: number }) => (
  <Svg {...p}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 2v2h6V2" />
    <circle cx="12" cy="10" r="2.4" />
    <path d="M8 18c.7-2 2.2-3 4-3s3.3 1 4 3" />
  </Svg>
);
export const UploadIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Svg>
);
export const FileIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Svg>
);
export const CheckIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
);
export const AlertIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg>
);
export const XIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
);
export const ArrowIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const PauseIcon = (p: { size?: number }) => (
  <Svg {...p}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Svg>
);
export const PlayIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M7 4l13 8-13 8z" /></Svg>
);
export const StopIcon = (p: { size?: number }) => (
  <Svg {...p}><rect x="5" y="5" width="14" height="14" rx="2" /></Svg>
);
export const DownloadIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></Svg>
);
export const GlobeIcon = (p: { size?: number }) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18z" /></Svg>
);
export const LockIcon = (p: { size?: number }) => (
  <Svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>
);
export const FolderIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>
);
export const RefreshIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></Svg>
);
export const PenIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="m15 5 4 4" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L7 20l-4 1 1-4z" /></Svg>
);

/** A decorative QR glyph for the brand mark — not a scannable code. */
export function QrGlyph({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 25 25" style={{ display: "block", color }}>
      <path
        fill="currentColor"
        d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM18 0h7v7h-7zM19 1v5h5V1zM20 2h3v3h-3zM0 18h7v7H0zM1 19v5h5v-5zM2 20h3v3H2zM9 0h2v2H9zM13 0h2v3h-2zM9 4h3v2H9zM16 3h2v2h-2zM9 8h2v2H9zM12 9h3v2h-3zM17 8h2v3h-2zM21 9h2v2h-2zM9 12h2v2H9zM13 13h2v2h-2zM17 12h3v2h-3zM22 13h2v2h-2zM9 16h2v3H9zM13 17h2v2h-2zM18 16h2v2h-2zM22 17h2v2h-2zM9 21h3v2H9zM14 21h2v3h-2zM18 21h2v2h-2zM22 22h2v2h-2z"
      />
    </svg>
  );
}
