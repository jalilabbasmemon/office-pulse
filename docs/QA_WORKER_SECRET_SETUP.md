# QA Worker / local secret setup (SEC-004)

Do **not** paste secrets into chat or commit them.

## 1. Obtain the secret (dashboard)

1. Open Supabase → project **officepulse-qa** (`hlcwsnhhmgjuxpebycyg`).
2. Project Settings → API → **secret** / legacy **service_role**.
3. Copy into a local file only.

## 2. Local Next (for Playwright against localhost)

```powershell
cd attendance-app
Copy-Item env.qa.example .env.qa.local
# Edit .env.qa.local — set SUPABASE_SECRET_KEY and disposable passwords.
# .env* is gitignored.
```

Playwright’s webServer loads `.env.qa.local` into the **Next process only** (not the browser).

## 3. QA Cloudflare Worker secret

```powershell
# Reads key from .env.qa.local without printing it
.\scripts\put-qa-worker-secret.ps1

# Or interactive (paste when prompted — nothing is logged by this doc):
npx wrangler secret put SUPABASE_SECRET_KEY --config wrangler.qa.jsonc
```

Confirm Worker name is **`office-pulse-qa`**, not `office-pulse`.

## 4. Deploy QA Worker (nonprod only)

```powershell
npm run deploy:qa
```

Then:

```powershell
$env:OFFICEPULSE_TEST_URL = "https://office-pulse-qa.jalilabbasmemon.workers.dev"
$env:E2E_ALLOW_PUNCH = "1"
# …set E2E_* disposable account env vars…
npx playwright test tests/e2e/security-punch-matrix.spec.ts --project=chromium-desktop
```

## 5. What Playwright must NOT receive

| Variable | Browser / Playwright | Next / Worker |
|----------|----------------------|---------------|
| `SUPABASE_SECRET_KEY` | **No** | **Yes** |
| `E2E_QA_SUPABASE_SECRET_KEY` | **Not required for punches** | Optional offline DB tooling only |
| Publishable / anon key | Yes (public) | Yes |

Punches go through authenticated `/api/attendance/*`. Verification uses `/api/attendance/today`, admin audit, and export APIs.
