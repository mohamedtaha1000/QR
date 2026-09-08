import { NextRequest, NextResponse } from "next/server";
import { emit, getRun, log } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: "Unknown run" }, { status: 404 });

  const { action } = (await request.json()) as { action: "pause" | "resume" | "stop" };
  if (action === "pause") { run.control.paused = true; log(id, "Paused"); }
  if (action === "resume") { run.control.paused = false; log(id, "Resumed"); }
  if (action === "stop") {
    run.control.stopped = true;
    run.control.paused = false;
    run.status = "stopping";
    log(id, "Stopping after the current person");
  }
  emit(id);
  return NextResponse.json({ ok: true });
}
