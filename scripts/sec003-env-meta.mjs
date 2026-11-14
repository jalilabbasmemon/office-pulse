import fs from "fs";

const path = ".env.local";
if (!fs.existsSync(path)) {
  console.log(JSON.stringify({ has_env_local: false }));
  process.exit(0);
}

const text = fs.readFileSync(path, "utf8");
const keys = {};
for (const line of text.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  keys[m[1]] = {
    len: v.length,
    prefix: v.slice(0, 12),
    is_jwt: v.split(".").length === 3,
    starts_sb: v.startsWith("sb_"),
  };
}

const interesting = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "E2E_QA_SUPABASE_SECRET_KEY",
  "E2E_QA_SUPABASE_URL",
];

const out = {};
for (const k of interesting) out[k] = keys[k] || null;

let urlHost = null;
try {
  const raw = fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
  if (raw) {
    let v = raw.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    urlHost = new URL(v).host;
  }
} catch {
  urlHost = "parse_error";
}

console.log(
  JSON.stringify({
    has_env_local: true,
    urlHost,
    keys: out,
    process_secret_prefix: (process.env.SUPABASE_SECRET_KEY || "").slice(0, 12),
    process_secret_len: (process.env.SUPABASE_SECRET_KEY || "").length,
  })
);
