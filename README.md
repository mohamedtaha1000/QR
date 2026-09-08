# STM QR Studio

A Next.js app that bulk-creates STM QR codes on qrcode-tiger.com. Upload a
sheet, review it, watch the codes get made, and each image downloads to your
Downloads folder as it finishes.

Runs the same on your laptop and on Vercel.

---

## How it works

One person per request. Your browser holds the list and calls the server once
for each row:

```
your browser                                the server
────────────                                ──────────
POST /api/session      ──────────────▶  signs in to QR Tiger, returns cookies
row 1 → POST /api/generate  ~20s  ──▶   opens Chromium, fills 13 fields,
        ◀── the PNG bytes                generates, names it, clicks Download
   saved to Downloads
row 2 → POST /api/generate  ~20s  ──▶   ...
```

Nothing is written to disk on the server and nothing is stored in a database.
That is what makes it deployable: each request finishes in about twenty seconds,
so it never runs into a hosting time limit, and the images go straight to
whoever is using the page.

Run history is kept in your browser's local storage, so it is yours alone.

---

## Running it on your machine

You need **Node.js 20 or newer** (`winget install OpenJS.NodeJS.LTS`).

```powershell
npm.cmd install
npm.cmd run setup      # downloads the Chromium that Playwright drives
npm.cmd run dev
```

Open **http://localhost:3000** and leave the terminal open — that is the server.

> PowerShell may refuse plain `npm` with a script-execution error. `npm.cmd`
> sidesteps it, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

**Signing in.** Copy `.env.example` to `.env.local` and fill in
`QRTIGER_EMAIL` / `QRTIGER_PASSWORD` and it signs itself in. Leave them empty
and it opens a browser window on the Generate step and waits for you instead.

---

## Deploying to Vercel

```powershell
npm.cmd i -g vercel
vercel
vercel --prod
```

Or push the folder to GitHub and import it at vercel.com — same thing with a UI.

**Three settings to get right:**

1. **Environment variables** — `QRTIGER_EMAIL` and `QRTIGER_PASSWORD` are
   *required* in production. There is no screen on a server, so signing in by
   hand is not an option there.
2. **`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`** — also an environment variable.
   Without it, the build tries to download a 150 MB browser it will not use.
3. **A paid plan, probably.** Free functions cap at 5 minutes each, which is
   plenty per person. But cold starts add 5–10 seconds to a request, and Pro
   gives 2 GB of memory, which Chromium wants.

`vercel.json` already asks for 2 GB and a 300-second ceiling per request.

### Before you deploy, check one thing

On Vercel the sign-in happens headless — no window, no human. If QR Tiger ever
shows a captcha or asks for a code, the deployed version cannot get past it and
no amount of code fixes that. Test it locally first:

```powershell
$env:HEADLESS="1"; npm.cmd run dev
```

Run one person. If it signs in and produces a QR with no window ever appearing,
Vercel will work. If it stalls at the login, stick to running it locally.

### What deploying means for your data

Staff names, mobile numbers and email addresses get sent to Vercel's servers to
be typed into the form, and the QR Tiger password is stored in Vercel's
environment. Nothing is retained after each request, but the data does leave the
STM network — worth clearing with whoever owns that decision.

---

## Where to change things

| What | Where |
|---|---|
| STM address, website, colour, templates, naming | `lib/qrTypes.ts` |
| Phone rules | `lib/phone.ts` |
| Every CSS selector on qrcode-tiger.com | `SELECTORS` in `lib/steps.ts` |
| The 17 steps themselves | `generateOne` in `lib/steps.ts` |
| Column aliases and row validation | `lib/qrTypes.ts` + `lib/parse.ts` |
| The batch loop, pausing, downloading | `lib/useRunner.ts` |
| Colours, spacing, type | `app/globals.css` |

**Adding the ID Card type** means filling in the `id` entry in `lib/qrTypes.ts`,
and branching inside `generateOne` if its steps differ from vCard. Nothing else
in the app knows the difference between the two types.

---

## Notes

- Your browser may ask once whether to allow multiple downloads from the site.
  Say yes. Or untick *"Save each QR as it finishes"* on the Review step and take
  a single ZIP at the end.
- The QR Tiger session lives in the page's memory only, never in storage.
  Refreshing mid-batch means signing in again.
- Locally the browser window is visible on purpose — it is easier to trust
  something you can watch. `HEADLESS=1` hides it.
- One batch at a time, one QR Tiger account. There is no queue, because a single
  account cannot generate two codes at once anyway.
