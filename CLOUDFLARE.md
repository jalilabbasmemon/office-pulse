# Cloudflare Workers setup checklist

## Fix these dashboard mistakes

### 1. `SUPABASE_SECRET_KEY` value is wrong

You currently have:

```text
SUPABASE_SECRET_KEY=eyJhbGciOi...
```

It must be **only** the JWT (no `SUPABASE_SECRET_KEY=` prefix):

```text
eyJhbGciOi...
```

Delete the secret and recreate it as type **Secret** with the raw JWT only.

### 2. `NEXT_PUBLIC_APP_URL` must not be localhost

Change from `http://localhost:3000` to your Worker URL, e.g.:

```text
https://office-pulse.<account>.workers.dev
```

Find it on the Worker **Deployments** / overview page.

### 3. `NEXT_PUBLIC_SUPABASE_URL` should be a Variable (not Secret)

Type: **Variable**  
Value: `https://jniyfhpwrjofdljqsdwd.supabase.co`

### 4. Add Build variables (required for Next.js)

Under **Builds → Variables and secrets**, add the same `NEXT_PUBLIC_*` values.  
Next.js inlines them at **build** time; runtime-only vars are not enough.

| Name | Type | Value |
|------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Variable | `https://jniyfhpwrjofdljqsdwd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Variable | `sb_publishable_…` |
| `NEXT_PUBLIC_APP_URL` | Variable | your `https://office-pulse.…workers.dev` |
| `SUPABASE_SECRET_KEY` | Secret | raw JWT only |

### 5. Do not put secrets in `wrangler.jsonc`

Keep `SUPABASE_SECRET_KEY` as a Cloudflare Secret only.

## After fixing

Trigger a new deploy (push to `main`, or **Retry deployment**).

Then in Supabase → Authentication → URL configuration:

- Site URL = your workers.dev URL  
- Redirect URLs include that URL + `/api/auth/callback`
