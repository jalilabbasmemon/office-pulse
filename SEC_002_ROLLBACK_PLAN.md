# SEC-002 / SEC-003 Rollback & Incident Plan

**Principle:** Prefer rolling **forward** (restore healthy service-role Worker) over restoring vulnerable employee write RLS.  
**Default rollback does NOT re-enable SEC-F-001 policies.**

---

## Severity classes

| Class | Symptom | First response |
|-------|---------|----------------|
| S1 | All punches fail after Worker deploy (secret missing / wrong project) | Redeploy last known-good Worker **with** correct `SUPABASE_SECRET_KEY`; do not touch RLS |
| S2 | Punches fail after RLS migration; Worker is old user-JWT writer | Redeploy SEC-002 service-role Worker immediately; keep restrictive RLS |
| S3 | Admin correction / export broken; punches OK | App-only redeploy of prior good SHA; RLS unchanged |
| S4 | Data corruption / mass bad punches | Freeze writes (maintenance), restore from backup/PITR per runbook, incident channel |

---

## App / Worker rollback (preferred)

1. Identify last known-good **production** Worker deployment id and git SHA.
2. Redeploy that artifact to Worker name `office-pulse` (not QA/preview).
3. Confirm `SUPABASE_SECRET_KEY` secret still present and matches **production** project.
4. Smoke: login, check-in, check-out, admin correction, export.
5. If RLS migration **already** applied, the rolled-back build **must** still use service-role writes. Do not roll back to a pre-SEC-002 Worker while restrictive RLS remains.

### Incompatible combinations (avoid)

| Worker | RLS | Result |
|--------|-----|--------|
| Pre-SEC-002 (user JWT writes) | Restrictive (no employee write) | Punches broken |
| SEC-002 (service role) | Legacy employee write policies | Works but F-001 open — only acceptable briefly before Phase C |
| Pre-SEC-002 | Legacy policies | Full F-001 regression — last resort only |

---

## Database rollback (last resort — requires explicit approval)

Restoring employee INSERT/UPDATE policies **re-opens SEC-F-001** (clients can write attendance via PostgREST).

Use only when:

1. Production punches are down,
2. A service-role Worker cannot be restored quickly, and
3. Jalil (or designated incident commander) **explicitly approves** temporary vulnerable RLS.

Then:

1. Open an incident; time-box the vulnerable window (e.g. ≤ 60 minutes).
2. Apply the emergency SQL below on production.
3. Parallel-track redeploy of SEC-002 Worker.
4. **Re-apply** `migration_attendance_writes_api_only.sql` as soon as the service-role Worker is healthy.
5. Run RLS negatives + punch smoke; close incident with postmortem.

```sql
-- EMERGENCY ONLY — restores SEC-F-001. Requires written incident approval.
-- Do NOT use as the default rollback path.

drop policy if exists "Admins update attendance" on public.attendance;

create policy "Employees insert own attendance"
  on public.attendance for insert
  with check (
    employee_id = (select id from public.employees where auth_user_id = auth.uid())
  );

create policy "Employees update own attendance"
  on public.attendance for update
  using (
    employee_id = (select id from public.employees where auth_user_id = auth.uid())
    or public.is_admin()
  );

create policy "Admins update attendance"
  on public.attendance for update
  using (public.is_admin())
  with check (public.is_admin());
```

---

## Backup / PITR recovery

If corruption or irreversible bad writes:

1. Confirm PITR / backup coverage for the incident start time (verified in pre-deploy P5).
2. Follow Supabase project restore procedure to a point before corruption.
3. Re-deploy the approved Worker SHA; re-apply SEC-002 migration if the restore predates it.
4. Re-run RLS negatives and authorized punch smokes.
5. Do not “fix forward” by manually editing attendance at scale without audit reasons.

---

## Excel / redirect / IP adapter only

App-only issues: redeploy prior good SHA. No database change. No RLS policy restoration.

---

## Incident checklist

- [ ] Incident channel opened; severity assigned  
- [ ] Access restricted to on-call + release engineer  
- [ ] Preferred path (Worker redeploy) attempted before any RLS restore  
- [ ] If emergency RLS used: approval recorded, time-box set, re-lock scheduled  
- [ ] Post-recovery smokes: punch in/out, admin correct+audit, export, redirect  
- [ ] Postmortem within 48h  
