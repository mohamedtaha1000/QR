import { NextResponse } from "next/server";
import { onServerless, openBrowser } from "@/lib/browser";
import { HOME_URL, isLoggedOut, signIn, wait } from "@/lib/steps";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Gets the app signed in to QR Tiger.
 *
 * On a desktop the login is kept in the browser profile, so this returns no
 * state — later calls simply reuse the profile. On Vercel it returns a
 * storageState the page passes back with every generate request.
 *
 * mode "auto"   — QRTIGER_EMAIL / QRTIGER_PASSWORD. Works anywhere.
 * mode "manual" — waits for a person to sign in inside the visible window.
 *                 Desktop only; a server has no screen.
 */
export async function POST(request: Request) {
  const { mode } = (await request.json().catch(() => ({}))) as { mode?: string };

  if (mode === "manual" && onServerless) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Signing in by hand needs a visible browser, and this host has no screen. " +
          "Set QRTIGER_EMAIL and QRTIGER_PASSWORD in the project's environment variables.",
      },
      { status: 400 },
    );
  }

  let session;
  try {
    session = await openBrowser();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not start Chromium: " +
          (error instanceof Error ? error.message : String(error)) +
          (onServerless ? "" : ". Run `npm run setup` to download it."),
      },
      { status: 500 },
    );
  }

  try {
    const page = session.context.pages()[0] ?? (await session.context.newPage());
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await wait(1500);

    if (await isLoggedOut(page)) {
      if (mode === "manual") {
        const deadline = Date.now() + 240000;
        while (Date.now() < deadline) {
          await wait(2000);
          if (!(await isLoggedOut(page))) break;
        }
        if (await isLoggedOut(page)) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Timed out after four minutes waiting for the sign-in. The browser " +
                "window should have opened on this machine — check it is not behind " +
                "another window.",
            },
            { status: 408 },
          );
        }
      } else {
        await signIn(page);
      }
    }

    // A profile-backed browser remembers the login itself.
    const state = session.usesProfile ? null : await session.context.storageState();
    return NextResponse.json({ ok: true, session: state, usesProfile: session.usesProfile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sign-in failed." },
      { status: 400 },
    );
  } finally {
    await session.close();
  }
}
