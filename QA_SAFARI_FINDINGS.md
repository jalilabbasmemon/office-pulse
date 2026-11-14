# OfficePulse — Safari / WebKit Findings (QA-002)

**Status:** Compatibility defects fixed in code; **real-device gate still open**.  
**Do not** claim Safari production-ready from WebKit alone.

## Confirmed defects (this pass)

### QA002-F1 — P0 InstallPrompt blocked Sign in (iPhone WebKit)

- **Symptom:** Tap Sign in never registers; overlay “Add to Home Screen” intercepts hits.  
- **Root cause:** Fixed bottom banner `z-50` on `/login`.  
- **Browsers:** iPhone WebKit (reproduced); likely real iPhone Safari.  
- **Files:** `components/pwa/install-prompt.tsx`  
- **Fix:** Hide install UI on `/login` and `/change-password`.  
- **Regression:** `tests/e2e/safari-install-prompt.spec.ts` — **pass** on webkit-iphone.

### QA002-F2 — P0 WebKit email `fill()` dropped value

- **Symptom:** Auth stayed on `/login`; email empty, password filled.  
- **Root cause:** Playwright WebKit + `type=email` fill flakiness (test harness).  
- **Files:** `tests/e2e/helpers/auth.ts`  
- **Fix:** `pressSequentially` + `toHaveValue` assert.  
- **Note:** Product HTML5 `required` correctly blocked empty email — not a server bug.

### QA002-F3 — P1 Hydration mismatch (Safari tip)

- **Symptom:** Client HTML added “Safari tip: … Private Relay …” vs SSR.  
- **Root cause:** `isIosSafari()` during render.  
- **Files:** `components/attendance/attendance-card.tsx`  
- **Fix:** Gate tip on post-mount `iosHint` (business copy unchanged).

### Prior product constraints (still valid)

| ID | Topic | Status |
|---|---|---|
| F1 legacy | GPS after user gesture on iOS | Preserved (GEO-007) |
| F2 legacy | Private Relay ≠ office IP | Correct rule; tip retained |
| F3 legacy | PWA `start_url: "/"` | Present |

## Security (related)

E2E IP adapter never overrides `cf-connecting-ip`; disabled in production (`lib/network/ip.ts` + `unit-ip-security.spec.ts`).

## Real device

Complete `QA_REAL_IPHONE_CHECKLIST.md`. Do **not** auto-set `E2E_REAL_IPHONE_PASS=1`.
