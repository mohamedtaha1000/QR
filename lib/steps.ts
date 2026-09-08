import type { BrowserContext, Download, Locator, Page } from "playwright-core";
import { normalizePhone } from "./phone";
import { fillTemplate, QrTypeDef, safeFileName, STM } from "./qrTypes";
import type { FieldKey } from "./qrTypes";

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

export const HOME_URL = "https://www.qrcode-tiger.com/";
export const LOGIN_URL = "https://www.qrcode-tiger.com/login";

const TYPE_DELAY = 30;
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function firstVisible(
  page: Page, candidates: string[], timeoutMs = 5000,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of candidates) {
      const locator = page.locator(selector).first();
      try {
        if ((await locator.count()) && (await locator.isVisible())) return locator;
      } catch { /* mid-render, try again */ }
    }
    await wait(180);
  }
  return null;
}

async function fillField(
  page: Page, candidates: string[], value: string, label: string, required = false,
): Promise<void> {
  if (!value && !required) return;
  const field = await firstVisible(page, candidates, 6000);
  if (!field) {
    if (required) throw new Error(`The ${label} field was not on the page`);
    return;
  }
  await field.click();
  await field.fill("");
  await field.type(value, { delay: TYPE_DELAY });
}

export async function isLoggedOut(page: Page): Promise<boolean> {
  return (await firstVisible(page, SELECTORS.loginMarkers, 1500)) !== null;
}

/** Sign in with QRTIGER_EMAIL / QRTIGER_PASSWORD. Throws with a readable reason. */
export async function signIn(page: Page): Promise<void> {
  const email = process.env.QRTIGER_EMAIL;
  const password = process.env.QRTIGER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "No QRTIGER_EMAIL / QRTIGER_PASSWORD is set, so I cannot sign in on my own.",
    );
  }

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wait(1500);

  const emailBox = await firstVisible(page, SELECTORS.loginEmail, 10000);
  const passwordBox = await firstVisible(page, SELECTORS.loginPassword, 10000);
  if (!emailBox || !passwordBox) {
    throw new Error("The QR Tiger login form did not look as expected.");
  }

  await emailBox.click();
  await emailBox.fill(email);
  await passwordBox.click();
  await passwordBox.fill(password);

  const submit = await firstVisible(page, SELECTORS.loginSubmit, 5000);
  if (!submit) throw new Error("No sign-in button was found on the login page.");
  await submit.click();

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await wait(1500);
    if (!(await isLoggedOut(page))) return;
  }
  throw new Error(
    "Signing in did not go through — the password may be wrong, or the account " +
      "is asking for a code or a captcha that only a person can answer.",
  );
}

export function extensionFor(buffer: Buffer): { extension: string; mimeType: string } {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.subarray(0, 8).equals(png)) return { extension: ".png", mimeType: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8)
    return { extension: ".jpg", mimeType: "image/jpeg" };
  if (buffer.subarray(0, 4).toString() === "%PDF")
    return { extension: ".pdf", mimeType: "application/pdf" };
  const head = buffer.subarray(0, 200).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")))
    return { extension: ".svg", mimeType: "image/svg+xml" };
  return { extension: ".png", mimeType: "image/png" };
}

/** Read a finished download into memory instead of onto disk. */
async function bytesFromDownload(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Fallback when the Download click produces no download event. */
async function bytesFromPage(page: Page): Promise<Buffer | null> {
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

  if (src.startsWith("data:")) {
    return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  }
  const response = await page.context().request.get(src, { timeout: 30000 });
  if (!response.ok()) return null;
  return Buffer.from(await response.body());
}

export interface GeneratedQr {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  qrName: string;
}

/**
 * The seventeen steps, for one person. Returns the image bytes — this function
 * never touches the filesystem, so it works the same in a Vercel function as
 * it does on a desktop.
 */
export async function generateOne(
  context: BrowserContext,
  type: QrTypeDef,
  values: Record<FieldKey, string>,
): Promise<GeneratedQr> {
  const page = context.pages()[0] ?? (await context.newPage());
  const row = values as unknown as Record<string, string>;

  const downloads: Download[] = [];
  const watch = (target: Page) => target.on("download", (d) => downloads.push(d));
  context.pages().forEach(watch);
  context.on("page", watch);

  await page.goto(type.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wait(1200);

  if (await isLoggedOut(page)) {
    const error = new Error("Signed out");
    (error as Error & { needsSession?: boolean }).needsSession = true;
    throw error;
  }

  const tab = await firstVisible(page, SELECTORS.vcardTab, 3000);
  if (tab) { await tab.click().catch(() => {}); await wait(900); }

  if (!(await firstVisible(page, SELECTORS.name, 15000))) {
    throw new Error("The vCard form never appeared.");
  }

  const radio = page.locator(`input[name="Vcard_theme"][value="${type.themeValue}"]`).first();
  if (await radio.count()) {
    const container = radio.locator("xpath=..");
    await container.scrollIntoViewIfNeeded().catch(() => {});
    await container.click({ timeout: 5000 }).catch(() => radio.check({ force: true }));
  }

  await fillField(page, SELECTORS.name, row.displayName, "name", true);
  await fillField(page, SELECTORS.company, STM.company, "company");
  await fillField(page, SELECTORS.position, row.jobTitle, "position");
  await fillField(page, SELECTORS.website, STM.website, "website");
  await fillField(page, SELECTORS.mobile, normalizePhone(row.mobile), "mobile");
  await fillField(page, SELECTORS.email, row.email, "email");
  await fillField(page, SELECTORS.country, STM.country, "country");
  await fillField(page, SELECTORS.state, STM.state, "state");
  await fillField(page, SELECTORS.street, STM.street, "street");
  await fillField(page, SELECTORS.city, STM.city, "city");

  const colorBox = await firstVisible(page, SELECTORS.color, 6000);
  if (colorBox) {
    await colorBox.click();
    await colorBox.fill("");
    await colorBox.type(type.color, { delay: TYPE_DELAY });
    await colorBox.press("Enter");
    await wait(300);
  }

  const generate = await firstVisible(page, SELECTORS.generate, 15000);
  if (!generate) throw new Error("The 'Generate dynamic QR code' button was not found.");
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

  const qrName = fillTemplate(type.qrNameTemplate, row);
  const nameBox = await firstVisible(page, SELECTORS.qrName, 20000);
  if (!nameBox) throw new Error("The 'Name your QR Code' box never appeared.");
  await nameBox.click();
  await nameBox.fill("");
  await nameBox.type(qrName, { delay: TYPE_DELAY });
  await wait(400);

  const button = await firstVisible(page, SELECTORS.download, 15000);
  if (!button) throw new Error("The green Download button never appeared.");

  downloads.length = 0;
  await button.scrollIntoViewIfNeeded();
  await button.click();

  const deadline = Date.now() + 75000;
  while (downloads.length === 0 && Date.now() < deadline) await wait(250);

  const bytes = downloads.length
    ? await bytesFromDownload(downloads[0])
    : await bytesFromPage(page);

  if (!bytes || bytes.length === 0) {
    throw new Error(
      "Download was clicked but nothing came back, and no QR image was found on the page.",
    );
  }

  const { extension, mimeType } = extensionFor(bytes);
  return {
    bytes,
    mimeType,
    qrName,
    fileName: `${safeFileName(fillTemplate(type.fileNameTemplate, row))}${extension}`,
  };
}
