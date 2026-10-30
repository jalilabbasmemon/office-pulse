/**
 * Creates the first admin user via Supabase service role.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *
 * Optional env:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_MOBILE
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i);
    const value = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? "admin@office.local";
const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
const name = process.env.ADMIN_NAME ?? "Office Admin";
const mobile = process.env.ADMIN_MOBILE ?? "03000000000";

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name, employee_id: "ADM001" },
});

if (authError) {
  console.error("Auth create failed:", authError.message);
  process.exit(1);
}

const { data: shift } = await supabase
  .from("shifts")
  .select("id")
  .eq("name", "Morning")
  .maybeSingle();

const { data: employee, error: empError } = await supabase
  .from("employees")
  .insert({
    employee_id: "ADM001",
    auth_user_id: authData.user.id,
    name,
    mobile,
    designation: "Administrator",
    shift_id: shift?.id ?? null,
    role: "ADMIN",
    status: "ACTIVE",
  })
  .select("*")
  .single();

if (empError) {
  console.error("Employee insert failed:", empError.message);
  console.error("Auth user was created:", authData.user.id);
  process.exit(1);
}

console.log("Admin ready:");
console.log("  email:", email);
console.log("  password:", password);
console.log("  employee_id:", employee.employee_id);
console.log("Change the password after first login.");
