import { NextResponse } from "next/server";
import { readHistory } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readHistory());
}
