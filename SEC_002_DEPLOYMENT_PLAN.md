# SEC-002 / SEC-003 Production Deployment Plan

**Status:** NOT AUTHORIZED for production execution.  
**Audience:** Release Manager + Principal Security Engineer.  
**Scope:** Live Worker `office-pulse` and production Supabase `jniyfhpwrjofdljqsdwd` only after Jalil written approval.

A Cloudflare **preview** or isolated QA Worker (`office-pulse-qa` / `wrangler.qa.jsonc`) does **not** update the live production Worker. Promotion is an explicit separate deploy of the same artifact to the production Worker name.

---

## 0. Preconditions (all mandatory)

| # | Gate | Evidence |
|---|------|----------|
| P1 | Written production approval from Jalil | Ticket / chat record |
| P2 | Exact release artifact identified | Git commit SHA + build id / Worker version |
| P3 | Working tree for that SHA is clean and tagged (or release branch cut) | `git status` / tag |
| P4 | Nonprod punch matrix green (SEC-003 Task A) with QA service role | `SECURITY_TEST_EVIDENCE.md` |
| P5 | Production Supabase **backup / PITR recovery verified** (restore drill or dashboard confirmation of recoverable window) | Screenshot / runbook note |
| P6 | Maintenance window scheduled and communicated | Calendar + stakeholder ack |
| P7 | Access restriction plan for transition (who can punch / admin during window) | This plan §3 |
| P8 | `E2E_*` / `E2E_TRUSTED_IP_ADAPTER` **unset** on production Worker | Wrangler vars audit |
| P9 | Residual dependency risks accepted or mitigated | `SEC_003_RELEASE_READINESS_REPORT.md` |
| P10 | Real-device Safari checklist signed by a human | `QA_REAL_IPHONE_CHECKLIST.md` |

If any precondition fails → **STOP**. Do not start the production sequence.

---

## 1. Release artifact

Record before any production change:

```
Release name:     OfficePulse SEC-002 RC
Git commit SHA:   <40-char SHA of the approved tag>
Artifact build:   opennextjs-cloudflare build output for that SHA
Worker target:    office-pulse (production) — NOT office-pulse-qa
Supabase target:  jniyfhpwrjofdljqsdwd (production)
Migration file:   supabase/migration_attendance_writes_api_only.sql
```

Do not deploy “whatever is on disk.” Deploy only the SHA recorded above.

---

## 2. Deployment sequence (ordered)

### Phase A — Freeze & access restriction

1. Announce maintenance window start.
2. Restrict access during transition as agreed (examples: put app in read-only banner, pause office Wi‑Fi punch expectation, or keep Worker on previous build until Phase B completes). Document the chosen restriction in the incident channel.
3. Confirm production backup / PITR window covers current time (P5).

### Phase B — Deploy **updated production Worker first**

1. Build from the exact SHA: `opennextjs-cloudflare build`.
2. Deploy to production Worker name **`office-pulse`** with:
   - `NEXT_PUBLIC_APP_ENV=production`
   - Production Supabase URL + publishable key
   - `SUPABASE_SECRET_KEY` set as a **Worker secret** (service role / `sb_secret_…`)
   - **No** `E2E_TRUSTED_IP_ADAPTER`, `E2E_NONPROD_HOST`, or disposable E2E credentials
3. Confirm the **live** Worker version / deployment id matches the artifact (dashboard or `wrangler deployments list`). Preview/QA URLs are irrelevant here.
4. Smoke **before** RLS tightening: login + a controlled authorized punch still succeeds under **legacy** employee write policies (app already uses service-role writes; legacy RLS remains until Phase C).

**Why Worker before restrictive RLS:** If RLS drops employee INSERT/UPDATE first while an old Worker still writes with the user JWT, punches break immediately. Deploying the service-role Worker first keeps punches working through the migration.

### Phase C — Restrictive RLS migration (production Supabase)

1. Re-confirm Worker from Phase B is healthy.
2. Apply `migration_attendance_writes_api_only.sql` to **production only** in this window.
3. **Immediately** run post-migration RLS negative tests (employee JWT cannot INSERT/UPDATE/DELETE attendance; unauthenticated writes denied).
4. Record results in `SECURITY_TEST_EVIDENCE.md`.

### Phase D — Authorized smoke (production)

Within the maintenance window, with disposable or designated smoke accounts only:

1. Employee check-in (GPS or authorized office IP as configured).
2. Employee check-out.
3. Duplicate punch rejection.
4. Admin correction + audit log row.
5. Admin Excel export opens; formula cells sanitized.
6. Auth callback rejects open redirect `next` values.

### Phase E — Exit maintenance

1. Lift access restriction.
2. Announce window end + Worker version + migration applied.
3. Watch error logs / punch failure rate for 30–60 minutes.

---

## 3. Access restriction during transition

Minimum controls:

- Only on-call admin + release engineer have dashboard / Wrangler / Supabase access.
- No schema edits outside the approved migration.
- No “quick fix” RLS restores without incident procedure (`SEC_002_ROLLBACK_PLAN.md`).
- Communicate to staff: punches may be briefly unavailable; do not use workarounds that bypass the app.

---

## 4. Forbidden actions

- Treating QA/preview Worker deploy as production.
- Enabling E2E IP adapter or nonprod hosts on production.
- Applying restrictive RLS **before** the service-role Worker is live.
- Skipping post-migration RLS negatives or punch smokes.
- Declaring GO without P1–P10.

---

## 5. Related docs

- Rollback / incident: `SEC_002_ROLLBACK_PLAN.md`
- Checklist: `PRODUCTION_RELEASE_CHECKLIST.md`
- Readiness: `SEC_003_RELEASE_READINESS_REPORT.md`
