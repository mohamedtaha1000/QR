import path from "node:path";
import fs from "node:fs";
import type { BrowserContext } from "playwright-core";

/** True when running as a Vercel Function rather than on someone's desktop. */
export const onServerless = Boolean(process.env.VERCEL);

/**
 * @sparticuz/chromium ships Chromium's shared libraries as brotli bundles and
 * decides which one to unpack — al2 or al2023 — by reading AWS_EXECUTION_ENV or
 * AWS_LAMBDA_JS_RUNTIME. It does that AT MODULE LOAD, in its top-level code.
 *
 * Vercel's Fluid compute deliberately hides AWS_EXECUTION_ENV, so neither is
 * set, neither bundle is unpacked, and Chromium dies with
 * `libnss3.so: cannot open shared object file`.
 *
 * Setting this here — module scope, before the dynamic import below — is what
 * makes it unpack the al2023 libraries and set LD_LIBRARY_PATH.
 */
if (
  onServerless &&
  !process.env.AWS_EXECUTION_ENV &&
  !process.env.AWS_LAMBDA_JS_RUNTIME
) {
  process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs22.x";
}

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
    const executablePath = await binary.executablePath();

    // Belt and braces: make sure the loader looks where the bundles unpack to,
    // whichever one the package chose.
    const libraryDirs = [
      "/tmp/al2023/lib",
      "/tmp/al2/lib",
      path.dirname(executablePath),
    ].filter((dir) => fs.existsSync(dir));
    process.env.LD_LIBRARY_PATH = Array.from(
      new Set([
        ...libraryDirs,
        ...(process.env.LD_LIBRARY_PATH ?? "").split(":").filter(Boolean),
      ]),
    ).join(":");

    const browser = await chromium.launch({
      args: binary.args,
      executablePath,
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
