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

/** Bumped whenever these steps change, so the log shows which code is live. */
export const STEPS_VERSION = "steps-4";

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

  // fill() sets the value and fires the input/change events React listens for,
  // and unlike click() it does not hit-test — so a dialog's backdrop sitting
  // over the form cannot block it. Clicking here was what timed out.
  try {
    await field.fill(value, { timeout: 8000 });
    return;
  } catch {
    /* fall through to setting it by hand */
  }

  await dismissOverlays(page);
  try {
    await field.fill(value, { timeout: 8000 });
    return;
  } catch {
    /* fall through */
  }

  // Last resort: drive the input directly. React tracks its own value, so the
  // native setter has to be used or the change is ignored.
  const ok = await field
    .evaluate((element, text) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) return false;
      setter.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return input.value === text;
    }, value)
    .catch(() => false);

  if (!ok && required) {
    throw new Error(`Could not type into the ${label} field.`);
  }
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

  let emailBox = await firstVisible(page, SELECTORS.loginEmail, 8000);
  let passwordBox = await firstVisible(page, SELECTORS.loginPassword, 4000);

  // /login did not give us a form — try reaching it from the home page instead.
  if (!emailBox || !passwordBox) {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await wait(1200);
    const link = await firstVisible(
      page,
      ['a[href*="/login"]', 'button:has-text("Log in")', 'a:has-text("Log in")'],
      5000,
    );
    if (link) {
      await link.click().catch(() => {});
      await wait(2000);
    }
    emailBox = await firstVisible(page, SELECTORS.loginEmail, 8000);
    passwordBox = await firstVisible(page, SELECTORS.loginPassword, 4000);
  }

  if (!emailBox || !passwordBox) {
    throw new Error(
      "Could not find the email and password boxes on the QR Tiger login page. " +
        "Sign in by hand once in the browser window — the profile remembers it.",
    );
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

/**
 * Get rid of any dialog sitting over the form.
 *
 * After signing in, QR Tiger can throw up a Material-UI modal — onboarding, an
 * upsell, a notice. Its backdrop swallows every click, so filling the form times
 * out with "subtree intercepts pointer events".
 *
 * Dismissals here are deliberately non-committal: a close button, Escape, or
 * removing the overlay from the DOM. It never clicks anything that would accept
 * terms or agree to something on your behalf — that is not a decision for a
 * script to make.
 *
 * Returns the dialog's text, so a later failure can mention what appeared.
 */
async function dismissOverlays(page: Page): Promise<string | null> {
  const present = async () =>
    (await page.locator(".MuiModal-root, .MuiBackdrop-root").count().catch(() => 0)) > 0;

  if (!(await present())) return null;

  const text =
    (await page.locator(".MuiModal-root").first().innerText().catch(() => ""))
      ?.replace(/\s+/g, " ")
      .trim()
      .slice(0, 300) || null;

  const closers = [
    '.MuiModal-root [aria-label="close"]',
    '.MuiModal-root [aria-label="Close"]',
    ".MuiModal-root .qr-close",
    ".MuiModal-root .circle-delete",
    '.MuiModal-root button:has-text("Close")',
    '.MuiModal-root button:has-text("Skip")',
    '.MuiModal-root button:has-text("Not now")',
    '.MuiModal-root button:has-text("Maybe later")',
    '.MuiModal-root button:has-text("No thanks")',
    '.MuiModal-root button:has-text("Dismiss")',
  ];

  for (const selector of closers) {
    const closer = page.locator(selector).first();
    if (await closer.count().catch(() => 0)) {
      await closer.click({ timeout: 2500 }).catch(() => {});
      await wait(600);
      if (!(await present())) return text;
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
  await wait(600);
  if (!(await present())) return text;

  // Last resort: move the overlay out of the way rather than answer it.
  await page
    .evaluate(() => {
      for (const node of Array.from(
        document.querySelectorAll(".MuiModal-root, .MuiBackdrop-root"),
      )) {
        node.remove();
      }
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.body.removeAttribute("aria-hidden");
    })
    .catch(() => {});
  await wait(400);
  return text;
}

/**
 * Click "Generate dynamic QR code".
 *
 * The button ships disabled and only enables once the form satisfies the site's
 * own validation, so clicking it blind does nothing and every later step fails
 * looking for a result that was never produced. Wait for it to enable, and say
 * what is wrong if it never does.
 */
async function clickGenerate(page: Page): Promise<void> {
  const button = await firstVisible(page, SELECTORS.generate, 15000);
  if (!button) throw new Error("The 'Generate dynamic QR code' button was not found.");

  await button.scrollIntoViewIfNeeded().catch(() => {});

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const disabled = await button
      .evaluate((element) => {
        const target = element as HTMLButtonElement;
        return target.disabled || target.classList.contains("disabled");
      })
      .catch(() => true);
    if (!disabled) break;
    await wait(500);
  }

  const stillDisabled = await button
    .evaluate((element) => {
      const target = element as HTMLButtonElement;
      return target.disabled || target.classList.contains("disabled");
    })
    .catch(() => false);

  if (stillDisabled) {
    throw new Error(
      "The Generate button stayed disabled, so the site considers the form " +
        "incomplete — usually a missing name, a phone number it will not accept, " +
        "or a template that was never selected.",
    );
  }

  await button.click({ force: true });
  await wait(2500);
}

/**
 * Pick the vCard layout template.
 *
 * The radio itself is visually hidden inside the slide, so Playwright's own
 * check() refuses it ("clicking the checkbox did not change its state"). What a
 * person actually clicks is the preview image. Try that first, then the slide,
 * then a real DOM click on the input — React listens for that — and only give
 * up once none of them has left the radio checked.
 */
async function selectTheme(page: Page, value: string): Promise<void> {
  const radio = page.locator(`input[name="Vcard_theme"][value="${value}"]`).first();
  if (!(await radio.count())) return;
  if (await radio.isChecked().catch(() => false)) return;

  const slide = radio.locator("xpath=..");
  await slide.scrollIntoViewIfNeeded().catch(() => {});

  const attempts: Array<() => Promise<unknown>> = [
    () => slide.locator("img").first().click({ timeout: 4000, force: true }),
    () => slide.click({ timeout: 4000, force: true }),
    () => radio.evaluate((element) => (element as HTMLElement).click()),
    () => radio.check({ force: true, timeout: 4000 }),
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
    } catch {
      /* try the next approach */
    }
    await wait(500);
    if (await radio.isChecked().catch(() => false)) return;
  }

  throw new Error(
    `Could not select vCard template ${value} — the template picker markup has ` +
      "probably changed. Check SELECTORS in lib/steps.ts.",
  );
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

  await dismissOverlays(page);

  await selectTheme(page, type.themeValue);

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
    await colorBox.fill(type.color, { timeout: 8000 }).catch(() => {});
    await colorBox.press("Enter").catch(() => {});
    await wait(300);
  }

  await dismissOverlays(page);
  await clickGenerate(page);

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
      await template.click({ force: true });
      await wait(800);
    }
  }

  const qrName = fillTemplate(type.qrNameTemplate, row);
  const nameBox = await firstVisible(page, SELECTORS.qrName, 20000);
  if (!nameBox) throw new Error("The 'Name your QR Code' box never appeared.");
  await dismissOverlays(page);
  await nameBox.fill(qrName, { timeout: 8000 }).catch(async () => {
    await nameBox.type(qrName, { delay: TYPE_DELAY });
  });
  await wait(400);

  const button = await firstVisible(page, SELECTORS.download, 15000);
  if (!button) throw new Error("The green Download button never appeared.");

  downloads.length = 0;
  await dismissOverlays(page);
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click({ force: true });

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
