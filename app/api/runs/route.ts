import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { ParsedRow } from "@/lib/parse";
import { fillTemplate, QR_TYPES, QrTypeDef } from "@/lib/qrTypes";
import { createRun, RunState } from "@/lib/store";
import { runBatch } from "@/lib/generator";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    type: QrTypeDef["id"];
    fileName: string;
    rows: ParsedRow[];
  };

  const type = QR_TYPES[body.type];
  if (!type?.ready) {
    return NextResponse.json({ error: "That QR type is not configured yet." }, { status: 400 });
  }
  if (!body.rows?.length) {
    return NextResponse.json({ error: "No rows to generate." }, { status: 400 });
  }

  const id = `run_${Date.now().toString(36)}`;
  const stamp = new Date().toISOString().slice(0, 10);
  const run: RunState = createRun({
    id,
    type: body.type,
    fileName: body.fileName,
    outputDir: path.join(process.cwd(), "output", stamp, id),
    startedAt: Date.now(),
    finishedAt: null,
    status: "starting",
    message: "",
    rows: body.rows.map((row) => ({
      rowNumber: row.rowNumber,
      code: row.values.code,
      displayName: row.values.displayName,
      qrName: fillTemplate(type.qrNameTemplate, row.values as unknown as Record<string, string>),
      status: "queued",
      detail: "Queued",
      file: null,
      seconds: null,
    })),
    log: [],
    control: { paused: false, stopped: false },
  });

  void runBatch(run, body.rows);
  return NextResponse.json({ id });
}
