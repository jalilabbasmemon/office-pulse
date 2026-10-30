# OfficePulse — Usage Manual

OfficePulse is a mobile-first office attendance app. Employees check in and out only when they are on the **office Wi‑Fi** and **physically at the office** (GPS). Admins manage people, shifts, office location, and reports.

---

## 1. Quick start (first-time setup)

Do these steps **once** before day-to-day use.

### 1.1 Database (Supabase)

In Supabase → **SQL Editor**, run (if not already done):

1. `supabase/schema.sql`
2. `supabase/migration_must_change_password.sql`
3. `supabase/migration_late_early.sql`

### 1.2 Admin login

Default bootstrap account (change password after first login):

| Field | Value |
|--------|--------|
| Email | `admin@office.local` |
| Password | `ChangeMe123!` |

Open the app URL (local: `http://localhost:3000`, or your Cloudflare Worker URL).

### 1.3 Configure the office (required)

Sign in as admin → **Settings**:

1. **Office name / address**
2. **Latitude & longitude**  
   - Stand at the office and tap **Use current location**, or type coordinates manually  
3. **Allowed radius** — start with `150` meters  
4. **Max GPS accuracy** — start with `100` meters (phones only; desktops often fail)  
5. **Office public IP**  
   - Connect a phone/PC to **office Wi‑Fi**  
   - Tap **Use my current IP** → **Save settings**

Without a correct office IP and GPS, check-in/out will be rejected.

### 1.4 Create shifts

Go to **Shifts** → add shifts, for example:

| Name | Start | End | Grace |
|------|--------|-----|-------|
| Morning | 09:00 | 18:00 | 15 minutes |
| Late | 11:00 | 20:00 | 15 minutes |

**Grace** = how late someone may check in before they are marked **LATE**.

### 1.5 Create employees

Go to **Employees** → **Add employee**:

- **Employee ID** and **temporary password** are generated automatically  
- Fill name, mobile, designation, shift, role, login email  
- After create, **copy the credentials** shown and share with the employee  
- They must **change password on first login**

---

## 2. How attendance validation works

Every **check-in** and **check-out** must pass **all** of these (server decides; the phone cannot cheat):

| Check | Meaning |
|--------|---------|
| Logged in + active | Account exists and is not deactivated |
| Office Wi‑Fi | Request public IP matches **Office public IP** |
| GPS available | Browser location permission allowed |
| GPS accuracy OK | Accuracy ≤ Max GPS accuracy (e.g. ≤ 100 m) |
| Inside radius | Distance to office ≤ Allowed radius (e.g. ≤ 150 m) |
| Valid state | Cannot check in twice; cannot check out without check-in |

**Note:** Browsers cannot read Wi‑Fi name (SSID). The system uses the office **public IP** instead. Connect to office Wi‑Fi so your phone shares that IP.

---

## 3. Employee guide

### 3.1 Sign in

1. Open OfficePulse on your **phone** (recommended)  
2. Enter email + password  
3. If asked, **set a new password** (first login only)

### 3.2 Daily check-in

1. Connect to **office Wi‑Fi**  
2. Open **Home / My Punch**  
3. Allow **location** when the browser asks  
4. Wait until Location shows **Office** and GPS accuracy looks good  
5. Tap **CHECK IN**

**Late:** If you check in after shift start + grace (e.g. after 09:15 for a 09:00 shift with 15 min grace), you get a **LATE** badge.

### 3.3 Daily check-out

1. Still on office Wi‑Fi, at the office, with GPS OK  
2. Tap **CHECK OUT**  
3. Confirm the dialog:
   - **Before shift end** → “Leaving before shift end?” (early leave warning)  
   - **At/after shift end** → “Confirm check-out” (prevents accidents)  
4. Confirm only if you mean to leave  

Early check-out is stored as **EARLY**.

### 3.4 Change password (while logged in)

1. Open **Password** in the menu, or **Profile → Change password**  
2. Enter current password + new password twice  
3. Save  

### 3.5 Forgot password

There is no self-service email reset in the MVP. Ask an admin:

1. Admin opens **Employees → Edit** that person  
2. Taps **Reset password**  
3. Shares the temporary password privately  
4. You log in with the temp password → forced to set a new password  

### 3.6 Other employee screens

| Screen | Purpose |
|--------|---------|
| **History** | Your monthly in/out/hours |
| **Profile** | View your ID, shift, designation (read-only) |
| **Password** | Change your own password anytime |

Employees **cannot** edit attendance, see others’ records, or change office settings.

---

## 4. Admin guide

### 4.1 Navigation

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Today’s present / absent / working / checked out |
| **Employees** | Create, edit, deactivate |
| **Attendance** | Day view + correct a record |
| **Reports** | Monthly list + **Export Excel** |
| **Shifts** | Create/manage shift times |
| **Settings** | Office GPS, radius, public IP |
| **Audit** | Log of admin changes |
| **My Punch** | Admin’s own check-in/out (same rules) |

### 4.2 Manage employees

- **Create** — auto ID + temp password; share credentials once  
- **Edit** — name, mobile, designation, shift, role  
- **Reset password** — issues a temporary password; employee must change it after login  
- **Deactivate** — blocks login; history is kept (no hard delete)

### 4.3 Correct attendance

1. **Attendance** → pick date  
2. Tap **Correct** on a row  
3. Adjust check-in / check-out times  
4. Enter a **reason** (required)  
5. Save — change is written to **Audit**

### 4.4 Reports & Excel

1. **Reports** → choose month  
2. Review the table  
3. Tap **Export Excel** for download (daily sheet + summary)

### 4.5 Update office IP (if internet IP changes)

Office routers sometimes get a new public IP.

1. On office Wi‑Fi → **Settings**  
2. **Use my current IP** → Save  
3. Tell staff to refresh and punch again  

---

## 5. Late & early leave rules

| Event | Rule | Shown as |
|--------|------|----------|
| Check-in after start + grace | Marked late | **LATE** |
| Check-out before shift end | Marked early leave (after confirm) | **EARLY** |
| Check-out at/after end | Normal close | Confirm dialog only |

Example Morning shift `09:00–18:00`, grace `15`:

- Check-in **09:10** → on time  
- Check-in **09:20** → **LATE**  
- Check-out **17:30** → warning + **EARLY** if confirmed  
- Check-out **18:05** → normal confirm  

---

## 6. Install as an app (recommended)

OfficePulse can be installed like an app:

### Android / Chrome / Edge (phone or desktop)
1. Open the site in Chrome or Edge  
2. When the **Install OfficePulse** banner appears, tap **Install app**  
3. Or use the browser menu → **Install app** / **Cast, save, and share → Install page as app**

### iPhone / iPad (Safari)
1. Open the site in Safari  
2. Tap **Share** → **Add to Home Screen**  
3. Confirm **Add**

After install, open OfficePulse from the home screen / desktop shortcut for faster punch.

## 7. Device & network tips

| Do | Don’t |
|----|--------|
| Use a **phone** for punch | Rely on a desktop/laptop GPS |
| Stay on **office Wi‑Fi** | Use mobile data / home Wi‑Fi |
| Allow location + stand near a window if needed | Punch from outside the building |
| Tap **Refresh location** if status is wrong | Spam check-in if GPS is still “Checking…” |

If GPS accuracy shows thousands of meters, you are likely on a PC — use a phone, or temporarily raise **Max GPS accuracy** in Settings for testing only.

---

## 8. Common errors

| Message | What to do |
|---------|------------|
| Office network not detected | Connect to office Wi‑Fi; admin may need to update public IP |
| You are outside the office | Move closer; confirm office coordinates/radius |
| GPS accuracy is too low | Use phone outdoors/near window; refresh location |
| Location access is required | Enable location for the browser/site |
| Already checked in / out | One punch each per day |
| Account inactive | Ask admin to reactivate |

---

## 9. Security notes

- Never share the Supabase **secret / service_role** key  
- Employees change temporary passwords on first login  
- Admins should change the default admin password  
- Attendance times use **server time**, not the phone clock  

---

## 10. Roles summary

| | Admin | Employee |
|--|--------|----------|
| Check in/out | Yes | Yes |
| Own history | Yes | Yes |
| Manage staff / shifts / office | Yes | No |
| Correct attendance | Yes | No |
| Excel export | Yes | No |
| Audit logs | Yes | No |

---

## 11. Support checklist for admins

Before blaming the app, verify:

1. [ ] Employee is **ACTIVE** and has a **shift**  
2. [ ] Office **GPS** and **radius** are correct  
3. [ ] Office **public IP** matches current office internet  
4. [ ] Employee is on office Wi‑Fi on a **phone**  
5. [ ] Location permission is allowed  
6. [ ] SQL migrations for late/early and password flags have been run  

---

*Product: OfficePulse · Attendance for small offices*
