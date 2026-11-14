# SEC-003 — Real-device Safari / PWA checklist

**Automation is not a substitute.** WebKit Playwright (`webkit-iphone`) covers regression only.  
**Human sign-off required.** Do not set `E2E_REAL_IPHONE_PASS=1` until this form is complete.

Preserves QA-002 Safari fixes: InstallPrompt hidden on auth routes; WebKit fill via `pressSequentially`; Safari tip via `iosHint` after mount.

## Device under test

| Field | Value |
|-------|-------|
| Tester name | |
| Date | |
| iPhone model | |
| iOS / Safari version | |
| Network (office Wi‑Fi / cellular / both) | |
| Private Relay On/Off | |
| App URL (must be HTTPS QA or approved staging — not localhost) | |
| Account (disposable QA only) | |

## Required flows

| # | Flow | Pass? | Notes |
|---|------|-------|-------|
| 1 | Safari login (Sign in not blocked by install banner) | ☐ | |
| 2 | Session refresh (background ≥30s, resume — session OK or safe re-login) | ☐ | |
| 3 | Location permission (Enable location → system prompt; deny recoverable) | ☐ | |
| 4 | Check-in (GPS and/or office Wi‑Fi path) | ☐ | |
| 5 | Check-out | ☐ | |
| 6 | Logout | ☐ | |
| 7 | Installed PWA (Add to Home Screen → standalone login + punch + relaunch) | ☐ | |

## Sign-off

I confirm this was executed on a **physical iPhone**, not WebKit emulation.

- Tester: _______________________
- Initials: __________
- Date: _________________________

**Status:** PENDING human execution (SEC-003).

Companion detail form: `QA_REAL_IPHONE_CHECKLIST.md`.
