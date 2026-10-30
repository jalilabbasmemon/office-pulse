# OfficePulse — Usage Manual

**Live app:** [https://office-pulse.jalilabbasmemon.workers.dev](https://office-pulse.jalilabbasmemon.workers.dev)  
**Local (developers):** `http://localhost:3000`

OfficePulse is a mobile-first attendance system for a small office. Employees check in and out only when they are on **office Wi‑Fi** and **physically at the office** (GPS). Admins manage people, shifts, office location, reports, and password resets.

---

## Table of contents

1. [Quick start (admins)](#1-quick-start-admins)  
2. [How validation works](#2-how-validation-works)  
3. [Employee guide](#3-employee-guide)  
4. [Admin guide](#4-admin-guide)  
5. [Late & early leave](#5-late--early-leave)  
6. [Install as an app (PWA)](#6-install-as-an-app-pwa)  
7. [Device & network tips](#7-device--network-tips)  
8. [Common errors](#8-common-errors)  
9. [Cloudflare & secrets (ops)](#9-cloudflare--secrets-ops)  
10. [Roles summary](#10-roles-summary)  
11. [Support checklist](#11-support-checklist)  

---

## 1. Quick start (admins)

Do these steps **once** before day-to-day use.

### 1.1 Database (Supabase)

In Supabase → **SQL Editor**, run (if not already done):

1. `supabase/schema.sql`  
2. `supabase/migration_must_change_password.sql`  
3. `supabase/migration_late_early.sql`  

### 1.2 Open the app & admin login

Open the production URL (or local). Bootstrap admin (change password after first login):

| Field | Value |
|--------|--------|
| Email | `admin@office.local` |
| Password | `ChangeMe123!` |

### 1.3 Configure the office (required)

**Settings**:

1. Office name / address  
2. **Latitude & longitude** — use **Use current location** while standing at the office, or enter manually  
3. **Allowed radius** — start with `150` m  
4. **Max GPS accuracy** — start with `100` m (phones; desktops often fail)  
5. **Office public IP** — on office Wi‑Fi tap **Use my current IP** → **Save**  

Without a correct office IP and GPS, check-in/out will be rejected.

### 1.4 Create shifts

**Shifts** → add, for example:

| Name | Start | End | Grace |
|------|--------|-----|-------|
| Morning | 09:00 | 18:00 | 15 minutes |
| Late | 11:00 | 20:00 | 15 minutes |

**Grace** = how late someone may check in before they are marked **LATE**.

### 1.5 Create employees

**Employees** → **Add employee**:

- **Employee ID** and **temporary password** are generated automatically  
- Fill name, mobile, designation, shift, role, login email  
- After create, **copy the credentials** and share privately  
- Employee must **change password on first login**  

---

## 2. How validation works

Every **check-in** and **check-out** uses the **same** server checks (the phone cannot bypass them):

| Check | Meaning |
|--------|---------|
| Logged in + active | Account exists and is not deactivated |
| Office Wi‑Fi | Request public IP matches **Office public IP** |
| GPS available | Location permission allowed |
| GPS accuracy OK | Accuracy ≤ Max GPS accuracy |
| Inside radius | Distance to office ≤ Allowed radius |
| Valid state | No double check-in; no check-out without check-in |

Browsers **cannot** read Wi‑Fi name (SSID). The app uses the office **public IP**. Staff must use office Wi‑Fi so their phone shares that IP.

---

## 3. Employee guide

### 3.1 Sign in

1. Prefer a **phone** (better GPS)  
2. Enter email + password  
3. On first login / after admin reset → you **must** set a new password  

### 3.2 Daily check-in

1. Connect to **office Wi‑Fi**  
2. Open **Home** (or installed app)  
3. Allow **location**  
4. Wait until Location shows **Office** and GPS accuracy is OK  
5. Tap **CHECK IN**  

If you arrive after shift start + grace → **LATE** badge.

### 3.3 Daily check-out

1. Still on office Wi‑Fi, at the office, GPS OK  
2. Tap **CHECK OUT**  
3. Confirm the dialog:
   - **Before shift end** → “Leaving before shift end?”  
   - **At/after shift end** → “Confirm check-out”  
4. Confirm only if you mean to leave  

Early confirmed check-out → **EARLY** badge.

### 3.4 Change password (anytime while logged in)

1. Menu → **Password**, or **Profile → Change password**  
2. Current password + new password (twice)  
3. Save  

### 3.5 Forgot password

No email self-reset in this version. Ask an admin:

1. Admin → **Employees → Edit** you  
2. **Reset password** → share the temporary password privately  
3. You log in → forced to choose a new password  

### 3.6 Employee screens

| Screen | Purpose |
|--------|---------|
| **Home** | Check in / out |
| **History** | Your monthly in/out/hours |
| **Profile** | ID, shift, designation (read-only) |
| **Password** | Change your password |

Employees cannot edit attendance, see others’ data, or change office settings.

---

## 4. Admin guide

### 4.1 Navigation

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Today’s present / absent / working / checked out |
| **Employees** | Create, edit, deactivate, reset password |
| **Attendance** | Day view + correct a record |
| **Reports** | Monthly list + **Export Excel** |
| **Shifts** | Shift times and grace |
| **Settings** | Office GPS, radius, public IP |
| **Audit** | Admin action log |
| **My Punch** | Admin’s own attendance (same Wi‑Fi + GPS rules) |
| **Password** | Change your own password |

### 4.2 Manage employees

- **Create** — auto ID + temp password  
- **Edit** — name, mobile, designation, shift, role  
- **Reset password** — temp password for forgotten logins (requires `SUPABASE_SECRET_KEY` on Cloudflare)  
- **Deactivate** — blocks login; history kept  

### 4.3 Correct attendance

1. **Attendance** → date  
2. **Correct** → edit times + **reason** (required)  
3. Saved to **Audit**  

### 4.4 Reports & Excel

**Reports** → month → **Export Excel**.

The workbook includes:

| Sheet | Contents |
|--------|----------|
| **Daily Attendance** | Date, employee, designation, shift times, check-in/out, hours, **Punctuality (On Time/Late)**, **Late?**, **Early Leave?**, flags, GPS distance, IPs |
| **Monthly Summary** | Per employee: days present, **on-time days**, **late days**, **early leave days**, missing checkout, total hours, late % |
| **Meta** | Month, timezone, totals, legend |

Ensure `migration_late_early.sql` has been run so Late / Early flags are stored.

### 4.5 Office IP changed?

1. On office Wi‑Fi → **Settings**  
2. **Use my current IP** → Save  
3. Staff refresh and punch again  

---

## 5. Late & early leave

| Event | Rule | Badge |
|--------|------|--------|
| Check-in after start + grace | Late | **LATE** |
| Check-out before shift end | Early leave (after confirm) | **EARLY** |
| Check-out at/after end | Normal | Confirm only |

Example Morning `09:00–18:00`, grace `15`:

- In **09:10** → on time  
- In **09:20** → **LATE**  
- Out **17:30** → early warning → **EARLY** if confirmed  
- Out **18:05** → normal confirm  

---

## 6. Install as an app (PWA)

Use the installed icon for faster daily punch.

### Android / Chrome / Edge

1. Open the live site  
2. Banner **Install OfficePulse** → **Install app**  
3. Or browser menu → **Install app** / **Install page as app**  

### iPhone / iPad (Safari)

1. Open in Safari  
2. **Share** → **Add to Home Screen** → **Add**  

If the banner was dismissed, clear site data or use another browser/profile to see it again.

---

## 7. Device & network tips

| Do | Don’t |
|----|--------|
| Use a **phone** for punch | Rely on desktop GPS |
| Stay on **office Wi‑Fi** | Use mobile data / home Wi‑Fi |
| Allow location; near a window if weak GPS | Punch from outside the radius |
| **Refresh location** if status stuck | Spam check-in while still “Checking…” |

Desktop GPS often shows thousands of meters accuracy — use a phone for production punches.

---

## 8. Common errors

| Message | What to do |
|---------|------------|
| Office network not detected | Office Wi‑Fi; admin may need to update public IP |
| Outside the office | Move closer; check Settings GPS/radius |
| GPS accuracy too low | Phone, open area, refresh location |
| Location access required | Allow location for the site |
| Already checked in / out | One in and one out per day |
| Account inactive | Ask admin to reactivate |
| Missing SUPABASE_SECRET_KEY | Ops: set Cloudflare Secret (see §9); needed for create employee / reset password |

---

## 9. Cloudflare & secrets (ops)

Worker name: **office-pulse**  
URL: `https://office-pulse.jalilabbasmemon.workers.dev`

### Runtime variables (Workers → Settings → Variables)

| Type | Name | Notes |
|------|------|--------|
| Variable | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| Variable | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| Variable | `NEXT_PUBLIC_APP_URL` | Worker URL above |
| Secret | `SUPABASE_SECRET_KEY` | **service_role JWT only** (starts with `eyJ…`). Never put `NAME=` prefix. Never commit to git. |

These public vars are also listed in `wrangler.jsonc`. The secret stays **only** in the Cloudflare dashboard.

### Build variables (Workers → Builds → Variables)

Add the same three `NEXT_PUBLIC_*` values as **build variables** so Next.js can use them while building.

### After changing secrets

Retry the action (e.g. Reset password). Redeploy only if the Worker still doesn’t see the secret.

### Supabase Auth URLs

In Supabase → Authentication → URL configuration, set Site URL / redirect URLs to include the Worker URL (and `/api/auth/callback` if used).

---

## 10. Roles summary

| Capability | Admin | Employee |
|------------|--------|----------|
| Check in/out | Yes | Yes |
| Own history / profile | Yes | Yes |
| Change own password | Yes | Yes |
| Create / edit / deactivate staff | Yes | No |
| Reset others’ passwords | Yes | No |
| Shifts & office settings | Yes | No |
| Correct attendance | Yes | No |
| Excel export / audit | Yes | No |

---

## 11. Support checklist

Before blaming the app:

1. [ ] Employee is **ACTIVE** and has a **shift**  
2. [ ] Office **GPS** + **radius** are correct  
3. [ ] Office **public IP** matches current office internet  
4. [ ] Staff on office Wi‑Fi on a **phone**  
5. [ ] Location permission allowed  
6. [ ] SQL migrations (password + late/early) have been run  
7. [ ] Cloudflare has `SUPABASE_SECRET_KEY` secret (for create/reset user)  
8. [ ] Build + runtime `NEXT_PUBLIC_*` vars are set  

---

*OfficePulse · Attendance for small offices*
