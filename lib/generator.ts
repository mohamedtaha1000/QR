import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, Download, Locator, Page } from "playwright";
import { ParsedRow } from "./parse";
import { normalizePhone } from "./phone";
import { fillTemplate, QR_TYPES, QrTypeDef, safeFileName, STM } from "./qrTypes";
import { appendHistory, emit, getRun, log, RunState } from "./store";

/** Every selector the site needs, in one place. */
export const SELECTORS = {
  vcardTab: ['a.menu-item[href="/qr-code-generator/vcard"]', 'a[title="vCard"]'],
  name: ['input[name="qrcodeVcardName"]'],
  company: ['input[name="qrcodeVcardOrganization"]'],
  position: ['input[name="qrcodeVcardTitle"]'],
  website: ['input[name="qrcodeVcardWebsite"]'],
  mobile: ['input[name="qrcodeVcardPhoneMobile"]'],
  email: ['input[name="qrcodeVcardEmail"]'],
  country: ['input[name="qrcodeVcardCountry"]'],
  state: ['input[name="qrcodeVcardState"]'],
  street: ['input[name="qrcodeVcardStreet"]'],
  city: ['input[name="qrcodeVcardCity"]'],
  color: ['input.form-control[spellcheck="false"]', 'input[spellcheck="false"]'],
  generate: ["#generate-qr-code", 'button:has-text("Generate dynamic QR code")'],
  qrName: [
    'input[placeholder="Name your QR Code (optional)"]',
    'input[placeholder*="Name your QR"]',
  ],
  download: [
    "div.btn-download button",
    ".btn-download button.btn-success",
    'button.btn-success:has-text("Download")',
  ],
  loginMarkers: ['input[type="password"]', 'button:has-text("Log in")'],
  loginEmail: [
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="mail" i]',
  ],
  loginPassword: ['input[type="password"]', 'input[name="password"]'],
  loginSubmit: [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
  ],
};

export const LOGIN_URL = "https://www.qrcode-tiger.com/login";

const TYPE_DELAY = 35;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function firstVisible(
  page: Page, candidates: string[], timeoutMs = 5000,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of candidates) {
      const locator = page.locator(selector).first();
      try {
        if ((await locator.count()) && (await locator.isVisible())) return locator;
      } catch { /* the page is mid-render, try again */ }
    }
    await wait(180);
  }
  return null;
}

async function fillField(
  page: Page, candidates: string[], value: string, required = false,
): Promise<void> {
  if (!value && !required) return;
  const field = await firstVisible(page, candidates, 6000);
  if (!field) {
    if (required) throw new Error("A required field was not on the page");
    return;
  }
  await field.click();
  await field.fill("");
  await field.type(value, { delay: TYPE_DELAY });
}

function extensionFor(buffer: Buffer): string {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return ".png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return ".jpg";
  if (buffer.subarray(0, 4).toString() === "%PDF") return ".pdf";
  const head = buffer.subarray(0, 200).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")))
    return ".svg";
  return ".png";
}

async function saveDownload(
  download: Download, outputDir: string, stem: string,
): Promise<string> {
  const staging = path.join(outputDir, `.${stem}.part`);
  await download.saveAs(staging);
  const suffix = path.extname(download.suggestedFilename()).toLowerCase();
  const known = [".png", ".jpg", ".jpeg", ".svg", ".pdf"];
  const extension = known.includes(suffix)
    ? suffix
    : extensionFor(fs.readFileSync(staging).subarray(0, 512));
  const target = path.join(outputDir, `${stem}${extension}`);
  fs.rmSync(target, { force: true });
  fs.renameSync(staging, target);
  return target;
}

/** Fallback when the click produces no download event. */
async function saveFromPage(
  page: Page, outputDir: string, stem: string,
): Promise<string | null> {
  const src: string | null = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    let best: string | null = null;
    let bestArea = 0;
    for (const img of Array.from(document.querySelectorAll("img"))) {
      const url = img.currentSrc || img.src;
      const area = (img.naturalWidth || 0) * (img.naturalHeight || 0);
      if (url && area > bestArea) { best = url; bestArea = area; }
    }
    if (canvas && canvas.width * canvas.height > bestArea) {
      try { return canvas.toDataURL("image/png"); } catch { /* tainted */ }
    }
    return best;
  });
  if (!src) return null;

  let data: Buffer;
  if (src.startsWith("data:")) {
    data = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  } else {
    const response = await page.context().request.get(src, { timeout: 30000 });
    if (!response.ok()) return null;
    data = Buffer.from(await response.body());
  }
  const target = path.join(outputDir, `${stem}${extensionFor(data)}`);
  fs.writeFileSync(target, data);
  return target;
}

async function isLoggedOut(page: Page): Promise<boolean> {
  return (await firstVisible(page, SELECTORS.loginMarkers, 1500)) !== null;
}

/**
 * Optional: sign in from QRTIGER_EMAIL / QRTIGER_PASSWORD in .env.local.
 * Returns true only if the sign-in visibly succeeded. Anything else — no
 * credentials, a changed form, a captcha, two-factor — falls back to the
 * human signing in by hand, which always works.
 */
async function tryAutoLogin(page: Page, runId: string): Promise<boolean> {
  const email = process.env.QRTIGER_EMAIL;
  const password = process.env.QRTIGER_PASSWORD;
  if (!email || !password) return false;

  log(runId, "Trying the saved credentials");
  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await wait(1500);

    const emailBox = await firstVisible(page, SELECTORS.loginEmail, 8000);
    const passwordBox = await firstVisible(page, SELECTORS.loginPassword, 8000);
    if (!emailBox || !passwordBox) {
      log(runId, "The login form did not look as expected — sign in by hand");
      return false;
    }

    await emailBox.click();
    await emailBox.fill(email);
    await passwordBox.click();
    await passwordBox.fill(password);

    const submit = await firstVisible(page, SELECTORS.loginSubmit, 5000);
    if (!submit) {
      log(runId, "No sign-in button found — sign in by hand");
      return false;
    }
    await submit.click();

    // Give it up to 25s to land somewhere signed in.
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      await wait(1500);
      if (!(await isLoggedOut(page))) {
        log(runId, "Signed in with the saved credentials");
        return true;
      }
    }
    log(runId, "The saved credentials did not get us in — sign in by hand");
    return false;
  } catch {
    log(runId, "Auto sign-in failed — sign in by hand");
    return false;
  }
}

async function generateOne(
  page: Page, downloads: Download[], type: QrTypeDef, row: ParsedRow, outputDir: string,
): Promise<string | null> {
  const values = row.values as unknown as Record<string, string>;

  await page.goto(type.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wait(1200);

  const tab = await firstVisible(page, SELECTORS.vcardTab, 3000);
  if (tab) { await tab.click().catch(() => {}); await wait(900); }

  if (!(await firstVisible(page, SELECTORS.name, 15000))) {
    throw new Error("The vCard form never appeared — are you still signed in?");
  }

  // Layout template
  const radio = page.locator(`input[name="Vcard_theme"][value="${type.themeValue}"]`).first();
  if (await radio.count()) {
    const container = radio.locator("xpath=..");
    await container.scrollIntoViewIfNeeded().catch(() => {});
    await container.click({ timeout: 5000 }).catch(() => radio.check({ force: true }));
  }

  await fillField(page, SELECTORS.name, values.displayName, true);
  await fillField(page, SELECTORS.company, STM.company);
  await fillField(page, SELECTORS.position, values.jobTitle);
  await fillField(page, SELECTORS.website, STM.website);
  await fillField(page, SELECTORS.mobile, normalizePhone(values.mobile));
  await fillField(page, SELECTORS.email, values.email);
  await fillField(page, SELECTORS.country, STM.country);
  await fillField(page, SELECTORS.state, STM.state);
  await fillField(page, SELECTORS.street, STM.street);
  await fillField(page, SELECTORS.city, STM.city);

  const colorBox = await firstVisible(page, SELECTORS.color, 6000);
  if (colorBox) {
    await colorBox.click();
    await colorBox.fill("");
    await colorBox.type(type.color, { delay: TYPE_DELAY });
    await colorBox.press("Enter");
    await wait(300);
  }

  const generate = await firstVisible(page, SELECTORS.generate, 15000);
  if (!generate) throw new Error("The 'Generate dynamic QR code' button was not found");
  await generate.click();
  await wait(2500);

  if (type.designTemplateFragment) {
    const template = await firstVisible(
      page,
      [
        `.template-item img[src*="${type.designTemplateFragment}"]`,
        `img[src*="${type.designTemplateFragment}"]`,
      ],
      15000,
    );
    if (template) {
      await template.scrollIntoViewIfNeeded();
      await template.click();
      await wait(800);
    }
  }

  const nameBox = await firstVisible(page, SELECTORS.qrName, 20000);
  if (!nameBox) throw new Error("The 'Name your QR Code' box never appeared");
  await nameBox.click();
  await nameBox.fill("");
  await nameBox.type(fillTemplate(type.qrNameTemplate, values), { delay: TYPE_DELAY });
  await wait(400);

  const button = await firstVisible(page, SELECTORS.download, 15000);
  if (!button) throw new Error("The green Download button never appeared");

  downloads.length = 0;
  await button.scrollIntoViewIfNeeded();
  await button.click();

  const deadline = Date.now() + 90000;
  while (downloads.length === 0 && Date.now() < deadline) await wait(250);

  const stem = safeFileName(fillTemplate(type.fileNameTemplate, values));
  if (downloads.length) return saveDownload(downloads[0], outputDir, stem);
  return saveFromPage(page, outputDir, stem);
}

export async function runBatch(run: RunState, rows: ParsedRow[]): Promise<void> {
  const type = QR_TYPES[run.type];
  fs.mkdirSync(run.outputDir, { recursive: true });

  const { chromium } = await import("playwright");
  const profileDir = path.join(process.cwd(), ".browser-profile");
  fs.mkdirSync(profileDir, { recursive: true });

  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      acceptDownloads: true,
      viewport: { width: 1440, height: 950 },
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const downloads: Download[] = [];
    const watch = (page: Page) => page.on("download", (d) => downloads.push(d));
    context.pages().forEach(watch);
    context.on("page", watch);

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://www.qrcode-tiger.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await wait(2000);

    if (await isLoggedOut(page)) {
      const auto = await tryAutoLogin(page, run.id);
      if (!auto) {
        run.status = "signin";
        run.message = "Sign in to QR Tiger in the browser window that opened.";
        emit(run.id);
        log(run.id, "Waiting for you to sign in");
        while (await isLoggedOut(page)) {
          if (run.control.stopped) break;
          await wait(2000);
        }
      }
      log(run.id, "Signed in");
    }

    run.status = "running";
    run.message = "";
    emit(run.id);

    for (const row of rows) {
      if (run.control.stopped) break;
      while (run.control.paused && !run.control.stopped) {
        run.status = "paused";
        emit(run.id);
        await wait(500);
      }
      if (run.control.stopped) break;
      run.status = "running";

      const entry = run.rows.find((r) => r.rowNumber === row.rowNumber)!;
      entry.status = "running";
      entry.detail = "Filling the form…";
      emit(run.id);

      const startedAt = Date.now();
      try {
        const file = await generateOne(page, downloads, type, row, run.outputDir);
        entry.status = "done";
        entry.file = file;
        entry.detail = file ? "Downloaded" : "Created (no file)";
        log(run.id, `${entry.displayName} — ${entry.detail}`);
      } catch (error) {
        entry.status = "failed";
        entry.detail = error instanceof Error ? error.message : String(error);
        log(run.id, `${entry.displayName} — failed: ${entry.detail}`);
        try {
          fs.mkdirSync(path.join(run.outputDir, "errors"), { recursive: true });
          await page.screenshot({
            path: path.join(run.outputDir, "errors", `${entry.code || entry.rowNumber}.png`),
            fullPage: true,
          });
        } catch { /* a missing screenshot must not mask the real error */ }
      }
      entry.seconds = Math.round((Date.now() - startedAt) / 100) / 10;
      emit(run.id);
      await wait(1200);
    }

    for (const entry of run.rows) {
      if (entry.status === "queued" || entry.status === "running") {
        entry.status = "skipped";
        entry.detail = "Stopped before this row";
      }
    }
    run.status = "done";
  } catch (error) {
    run.status = "error";
    run.message = error instanceof Error ? error.message : String(error);
    log(run.id, `Run failed: ${run.message}`);
  } finally {
    run.finishedAt = Date.now();
    emit(run.id);
    await context?.close().catch(() => {});
    const created = run.rows.filter((r) => r.status === "done").length;
    appendHistory({
      id: run.id,
      type: run.type,
      fileName: run.fileName,
      rows: run.rows.length,
      created,
      failed: run.rows.filter((r) => r.status === "failed").length,
      finishedAt: run.finishedAt,
      outputDir: run.outputDir,
    });
    emit(run.id);
  }
}

export function ensureRun(id: string): RunState {
  const run = getRun(id);
  if (!run) throw new Error("That run is no longer in memory — start a new one.");
  return run;
}
