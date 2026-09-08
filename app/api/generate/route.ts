import { NextResponse } from "next/server";
import { onServerless, openBrowser } from "@/lib/browser";
import { generateOne } from "@/lib/steps";
import { QR_TYPES } from "@/lib/qrTypes";
import type { GenerateRequest } from "@/lib/runTypes";

export const runtime = "nodejs";
/** One person per request, so this never needs the whole batch's time. */
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request body." }, { status: 400 });
  }

  const type = QR_TYPES[body.type];
  if (!type?.ready) {
    return NextResponse.json(
      { ok: false, error: "That QR type is not configured yet." },
      { status: 400 },
    );
  }
  // On Vercel the login only exists in the passed state; locally it is on disk.
  if (onServerless && !body.session) {
    return NextResponse.json({ ok: false, needsSession: true }, { status: 401 });
  }

  const session = await openBrowser(body.session);
  try {
    const result = await generateOne(session.context, type, body.values);
    return NextResponse.json({
      ok: true,
      fileName: result.fileName,
      mimeType: result.mimeType,
      qrName: result.qrName,
      image: result.bytes.toString("base64"),
    });
  } catch (error) {
    const needsSession = Boolean((error as Error & { needsSession?: boolean })?.needsSession);
    return NextResponse.json(
      {
        ok: false,
        needsSession,
        error: error instanceof Error ? error.message : "Generation failed.",
      },
      { status: needsSession ? 401 : 500 },
    );
  } finally {
    await session.close();
  }
}
