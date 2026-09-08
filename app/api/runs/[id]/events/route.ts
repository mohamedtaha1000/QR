/**
 * Retired. The batch loop now lives in the browser and calls /api/generate
 * once per person — see lib/useRunner.ts. Safe to delete this file.
 */
export const runtime = "nodejs";

export function GET() {
  return new Response("This endpoint was retired.", { status: 410 });
}
