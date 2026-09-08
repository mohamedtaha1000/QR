import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getRun } from "@/lib/store";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  const rowNumber = Number(request.nextUrl.searchParams.get("row"));
  const row = run?.rows.find((r) => r.rowNumber === rowNumber);

  if (!run || !row?.file || !fs.existsSync(row.file)) {
    return new Response("Not found", { status: 404 });
  }
  // Only ever serve from this run's own output folder.
  if (!path.resolve(row.file).startsWith(path.resolve(run.outputDir))) {
    return new Response("Not found", { status: 404 });
  }

  const data = fs.readFileSync(row.file);
  const disposition = request.nextUrl.searchParams.get("download")
    ? `attachment; filename="${path.basename(row.file)}"`
    : "inline";

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[path.extname(row.file).toLowerCase()] ?? "application/octet-stream",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
