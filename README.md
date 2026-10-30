# OfficePulse — Office Attendance System

Mobile-first attendance for a small office (~10 people). Check-in / check-out is accepted only when:

1. The user is authenticated and active  
2. The request comes from the configured office public IP  
3. GPS is available, accurate enough, and inside the office radius  
4. Server-side validation passes (the browser is never trusted)

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS  
- Supabase Auth + PostgreSQL + RLS  
- SheetJS Excel export  
- Cloudflare Workers via `@opennextjs/cloudflare`  

## Deploy to Cloudflare Workers

```bash
npm install
npx wrangler login
npm run deploy
```

Set these **Workers secrets / vars** in the Cloudflare dashboard (or via Wrangler):

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
# or SUPABASE_SERVICE_ROLE_KEY
```

Also configure plaintext vars for the Worker / build:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=https://office-pulse.<your-subdomain>.workers.dev
```

In Cloudflare Dashboard → Workers → your worker → **Settings → Variables**:

- Add the `NEXT_PUBLIC_*` values  
- Add secrets for the service/secret key  

For GitHub continuous deploy: connect `jalilabbasmemon/office-pulse` under **Workers Builds**, set the same env vars as **Build variables and secrets**, build command `npm run deploy` or use OpenNext build + deploy pipeline.

Local Workers preview:

```bash
npm run preview
```


## Quick start

### 1. Install

```bash
cd attendance-app
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com)  
2. Open **SQL Editor** and run `supabase/schema.sql`  
3. Copy project URL, anon key, and service role key  

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jniyfhpwrjofdljqsdwd.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...   # Project Settings → API (secret)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Bootstrap the first admin

```bash
node scripts/bootstrap-admin.mjs
```

Optional overrides: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_MOBILE`.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Configure the office

Sign in as admin → **Settings**:

- Set office GPS (or **Use current location**)  
- Set allowed radius (default 150 m)  
- Set max GPS accuracy (default 100 m)  
- Set **office public IP** (required for network checks)  

Find your public IP while on office Wi‑Fi (e.g. visit a “what is my IP” site).

## Roles

| Role | Capabilities |
|------|----------------|
| **ADMIN** | Employees, shifts, office settings, reports, Excel export, corrections, audit logs, own punch |
| **EMPLOYEE** | Login, check in/out, own history, own profile (read-only) |

## Key routes

- `/login` — authentication  
- `/dashboard` — punch card (GPS + server validation)  
- `/attendance` — employee history  
- `/admin/dashboard` — today’s overview  
- `/admin/employees` — create / edit / deactivate  
- `/admin/settings` — office IP + GPS geofence  
- `/admin/reports` — monthly view + Excel export  

## Attendance API

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/attendance/check-in` | Body: `{ latitude, longitude, accuracy }` — IP taken from request |
| POST | `/api/attendance/check-out` | Same GPS body |
| GET | `/api/attendance/today` | Current user today |
| GET | `/api/attendance/history?month=YYYY-MM` | Own history |

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser  
- Client GPS is only a hint; the server recomputes distance and checks IP  
- One attendance row per employee per day (`UNIQUE(employee_id, attendance_date)`)  
- Inactive employees cannot log in or punch  

## Product name

**OfficePulse** (from the project spec).
