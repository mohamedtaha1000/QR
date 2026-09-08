import { NextResponse } from "next/server";
import { launchBrowser, onServerless } from "@/lib/browser";
import { HOME_URL, isLoggedOut, signIn, wait } from "@/lib/steps";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Signs in and hands back a Playwright storageState the client keeps in memory
 * and passes to every /api/generate call.
 *
 * mode "auto"   — uses QRTIGER_EMAIL / QRTIGER_PASSWORD. Works anywhere.
 * mode "manual" — opens a visible browser and waits for a person to sign in.
 *                 Desktop only; there is no screen on a Vercel function.
 */
export async function POST(request: Request) {
  const { mode } = (await request.json().catch(() => ({}))) as { mode?: string };

  if (mode === "manual" && onServerless) {
    return NextResponse.json(
      { ok: false, error: "Signing in by hand needs a visible browser, which this host has none of. Set QRTIGER_EMAIL and QRTIGER_PASSWORD instead." },
      { status: 400 },
    );
  }

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    });
    const page = await context.newPage();
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await wait(1500);

    if (await isLoggedOut(page)) {
      if (mode === "manual") {
        // Up to four minutes for a person to type their password.
        const deadline = Date.now() + 240000;
        while (Date.now() < deadline) {
          await wait(2000);
          if (!(await isLoggedOut(page))) break;
        }
        if (await isLoggedOut(page)) {
          return NextResponse.json(
            { ok: false, error: "Timed out waiting for the sign-in." },
            { status: 408 },
          );
        }
      } else {
        await signIn(page);
      }
    }

    const session = await context.storageState();
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sign-in failed." },
      { status: 400 },
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
