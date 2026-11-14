# OfficePulse — Real iPhone Safari + PWA Checklist

**Purpose:** Human sign-off required for Safari **compatibility claim** (release decision B). WebKit emulation is **not** a substitute.  
**Do not** set `E2E_REAL_IPHONE_PASS=1` until every required item below is checked and signed.  
**SEC-004:** Automated P0 WebKit auth/install-prompt passed; this form remains **PENDING**.  
Emergency RLS/Worker hotfix (decision A) may proceed without this form once authorized punch matrix is green — do not conflate the two gates.

## Device under test

| Field | Value |
|---|---|
| Tester name | |
| Date | |
| iPhone model | |
| iOS version | |
| Network (office Wi‑Fi / cellular / both) | |
| Private Relay On/Off for site | |
| App URL (nonprod or prod HTTPS) | |
| Account used (must be disposable QA, not a real employee) | |

## A. Safari tab (required)

| # | Step | Pass? | Notes |
|---|---|---|---|
| A1 | Open `/login` — Sign in not covered by install banner | ☐ | |
| A2 | AUTH-001 Login with QA employee | ☐ | |
| A3 | AUTH-004 Background Safari 30s, resume — session OK or safe re-login | ☐ | |
| A4 | Off Wi‑Fi: GEO-007 tap **Enable location** → system prompt | ☐ | |
| A5 | GEO granted → GPS path can punch when inside branch | ☐ | |
| A6 | GEO denied → recoverable message; no crash | ☐ | |
| A7 | GEO-003 path: office Wi‑Fi + wifi-only enabled works without GPS | ☐ | |
| A8 | Private Relay On: IP path fails; GPS path still works if at branch | ☐ | |
| A9 | ATT-001 check-in / ATT-004 check-out | ☐ | |
| A10 | Duplicate check-in rejected | ☐ | |

## B. Add to Home Screen PWA (required)

| # | Step | Pass? | Notes |
|---|---|---|---|
| B1 | Share → Add to Home Screen | ☐ | |
| B2 | Open standalone icon — lands on `/` then role home | ☐ | |
| B3 | Login works in standalone | ☐ | |
| B4 | Kill app, reopen — session OK or safe login | ☐ | |
| B5 | Punch (GPS or Wi‑Fi path) works in standalone | ☐ | |
| B6 | Location permission for OfficePulse / Precise Location | ☐ | |

## C. Admin smoke on iPhone (if in scope)

| # | Step | Pass? | Notes |
|---|---|---|---|
| C1 | Admin login | ☐ | |
| C2 | Reports visible | ☐ | |
| C3 | REPORT-003 Excel download opens in Files/Numbers | ☐ | |

## Sign-off

I confirm the above was executed on a **physical iPhone**, not WebKit emulation.

- Tester: _______________________
- Signature / initials: __________
- Date: _________________________

Only after this form is complete may CI/local set:

```bash
E2E_REAL_IPHONE_PASS=1
```
