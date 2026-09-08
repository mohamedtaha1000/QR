import type { Browser } from "playwright-core";

/** True when running as a Vercel Function rather than on someone's desktop. */
export const onServerless = Boolean(process.env.VERCEL);

/**
 * One launcher for both homes.
 *
 * Locally: the Chromium that `npm run setup` downloaded, visible by default so
 * you can watch it work and sign in by hand. Set HEADLESS=1 to hide it, or
 * CHROMIUM_PATH to point at a browser you already have.
 *
 * On Vercel: the stripped Chromium from @sparticuz/chromium, headless, because
 * that is the only build small enough to ship inside a function.
 */
export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");

  if (onServerless) {
    const binary = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: binary.args,
      executablePath: await binary.executablePath(),
      headless: true,
    });
  }

  return chromium.launch({
    headless: process.env.HEADLESS === "1",
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}
