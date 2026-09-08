import path from "node:path";
import fs from "node:fs";
import type { BrowserContext } from "playwright-core";

/** True when running as a Vercel Function rather than on someone's desktop. */
export const onServerless = Boolean(process.env.VERCEL);

export interface Session {
  context: BrowserContext;
  close: () => Promise<void>;
  /** Locally the login lives in the profile on disk, so no state is passed around. */
  usesProfile: boolean;
}

/**
 * One browser for both homes.
 *
 * Locally: a persistent profile folder, visible by default. Signing in once
 * sticks — across requests and across restarts — exactly like the Python
 * script's `.browser-profile`.
 *
 * On Vercel: the stripped Chromium from @sparticuz/chromium, headless, with the
 * login carried in a storageState the page hands back on every request. There is
 * no disk to keep a profile on.
 */
export async function openBrowser(storageState?: unknown): Promise<Session> {
  const { chromium } = await import("playwright-core");

  if (onServerless) {
    const binary = (await import("@sparticuz/chromium")).default;
    const browser = await chromium.launch({
      args: binary.args,
      executablePath: await binary.executablePath(),
      headless: true,
    });
    const context = await browser.newContext({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storageState: (storageState as any) ?? undefined,
      viewport: { width: 1440, height: 950 },
      acceptDownloads: true,
    });
    return {
      context,
      usesProfile: false,
      close: async () => { await browser.close().catch(() => {}); },
    };
  }

  const profileDir = path.join(process.cwd(), ".browser-profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.HEADLESS === "1",
    executablePath: process.env.CHROMIUM_PATH || undefined,
    acceptDownloads: true,
    viewport: { width: 1440, height: 950 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return {
    context,
    usesProfile: true,
    close: async () => { await context.close().catch(() => {}); },
  };
}
