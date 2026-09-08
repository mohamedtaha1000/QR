import { NextRequest, NextResponse } from "next/server";
import { parseSheet } from "@/lib/parse";
import { QR_TYPES, QrTypeDef } from "@/lib/qrTypes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const typeId = String(form.get("type") ?? "vcard") as QrTypeDef["id"];
    const sheet = form.get("sheet");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    const type = QR_TYPES[typeId];
    if (!type) {
      return NextResponse.json({ error: "Unknown QR type." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseSheet(
      buffer, file.name, type, sheet ? String(sheet) : undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read that file." },
      { status: 400 },
    );
  }
}
