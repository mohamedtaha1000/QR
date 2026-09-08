import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { getRun } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return new Response("Unknown run", { status: 404 });

  const zip = new JSZip();
  let count = 0;
  for (const row of run.rows) {
    if (row.file && fs.existsSync(row.file)) {
      zip.file(path.basename(row.file), fs.readFileSync(row.file));
      count += 1;
    }
  }
  if (count === 0) return new Response("Nothing to download yet", { status: 404 });

  const body = await zip.generateAsync({ type: "nodebuffer" });
  const name = `${run.type}-qr-${new Date(run.startedAt).toISOString().slice(0, 10)}.zip`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
