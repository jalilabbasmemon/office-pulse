/**
 * Seeds disposable QA accounts into a NONPRODUCTION Supabase project.
 *
 * Usage (point env at officepulse-qa, never production):
 *   node scripts/seed-e2e-fixtures.mjs
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY for the QA project
 *   E2E_CONFIRM_NONPROD=1
 *
 * Writes credentials summary to stdout (not committed). Store in CI secrets.
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

if (process.env.E2E_CONFIRM_NONPROD !== "1") {
  console.error(
    "Refusing to seed: set E2E_CONFIRM_NONPROD=1 and point URL at the QA project only."
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

if (/jniyfhpwrjofdljqsdwd/i.test(url)) {
  console.error(
    "Refusing to seed production project ref jniyfhpwrjofdljqsdwd. Use officepulse-qa."
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = process.env.E2E_SEED_PASSWORD ?? "QaTemp!ChangeMe9";

const fixtures = [
  {
    key: "admin",
    email: "qa-admin@officepulse.test",
    name: "QA Admin",
    role: "ADMIN",
    employee_id: "QAADM01",
    must_change_password: false,
    status: "ACTIVE",
  },
  {
    key: "viewer",
    email: "qa-viewer@officepulse.test",
    name: "QA Viewer",
    role: "ADMIN_VIEWER",
    employee_id: "QAVIEW1",
    must_change_password: false,
    status: "ACTIVE",
  },
  {
    key: "employee",
    email: "qa-employee@officepulse.test",
    name: "QA Employee",
    role: "EMPLOYEE",
    employee_id: "QAEMP01",
    must_change_password: false,
    status: "ACTIVE",
  },
  {
    key: "force_pw",
    email: "qa-forcepw@officepulse.test",
    name: "QA Force Password",
    role: "EMPLOYEE",
    employee_id: "QAFPW01",
    must_change_password: true,
    status: "ACTIVE",
  },
  {
    key: "inactive",
    email: "qa-inactive@officepulse.test",
    name: "QA Inactive",
    role: "EMPLOYEE",
    employee_id: "QAINAC1",
    must_change_password: false,
    status: "INACTIVE",
  },
];

async function ensureUser(f) {
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.data?.users?.find(
    (u) => u.email?.toLowerCase() === f.email.toLowerCase()
  );
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: f.email,
    password,
    email_confirm: true,
    user_metadata: { name: f.name, employee_id: f.employee_id },
  });
  if (error) throw error;
  return data.user.id;
}

const { data: shift } = await supabase
  .from("shifts")
  .select("id")
  .eq("status", "ACTIVE")
  .limit(1)
  .maybeSingle();

let shiftId = shift?.id ?? null;
if (!shiftId) {
  const { data: created, error } = await supabase
    .from("shifts")
    .insert({
      name: "QA Morning",
      start_time: "09:00:00",
      end_time: "18:00:00",
      grace_minutes: 15,
      status: "ACTIVE",
    })
    .select("id")
    .single();
  if (error) {
    console.error("shift seed failed", error.message);
    process.exit(1);
  }
  shiftId = created.id;
}

// Office settings + HQ location for GPS tests (test coords only)
const { data: office } = await supabase
  .from("office_settings")
  .select("id")
  .limit(1)
  .maybeSingle();

if (!office) {
  await supabase.from("office_settings").insert({
    office_name: "QA Office",
    address: "QA only",
    latitude: 24.8607,
    longitude: 67.0011,
    allowed_radius_meters: 150,
    office_public_ip: "203.0.113.10",
    allowed_office_ips: ["203.0.113.10"],
    max_gps_accuracy_meters: 100,
    allow_wifi_only_punch: true,
    timezone: "Asia/Karachi",
  });
} else {
  await supabase
    .from("office_settings")
    .update({
      office_public_ip: "203.0.113.10",
      allowed_office_ips: ["203.0.113.10"],
      allow_wifi_only_punch: true,
      max_gps_accuracy_meters: 100,
      latitude: 24.8607,
      longitude: 67.0011,
    })
    .eq("id", office.id);
}

const { data: loc } = await supabase
  .from("office_locations")
  .select("id")
  .eq("name", "QA HQ")
  .maybeSingle();

if (!loc) {
  await supabase.from("office_locations").insert({
    name: "QA HQ",
    address: "QA",
    latitude: 24.8607,
    longitude: 67.0011,
    allowed_radius_meters: 150,
    is_active: true,
    sort_order: 0,
  });
}

const out = {};
for (const f of fixtures) {
  const authUserId = await ensureUser(f);
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("employee_id", f.employee_id)
    .maybeSingle();

  if (emp) {
    await supabase
      .from("employees")
      .update({
        auth_user_id: authUserId,
        name: f.name,
        role: f.role,
        status: f.status,
        must_change_password: f.must_change_password,
        shift_id: shiftId,
        mobile: "03000000000",
        designation: "QA",
      })
      .eq("id", emp.id);
  } else {
    const { error } = await supabase.from("employees").insert({
      employee_id: f.employee_id,
      auth_user_id: authUserId,
      name: f.name,
      mobile: "03000000000",
      designation: "QA",
      shift_id: shiftId,
      role: f.role,
      status: f.status,
      must_change_password: f.must_change_password,
    });
    if (error) {
      console.error("employee insert", f.email, error.message);
      process.exit(1);
    }
  }
  out[f.key] = { email: f.email, password };
}

console.log(JSON.stringify({ ok: true, fixtures: out, officeIp: "203.0.113.10" }, null, 2));
console.log(
  "\n# Suggested env (CI secrets — do not commit):\n" +
    `E2E_ADMIN_EMAIL=${out.admin.email}\n` +
    `E2E_ADMIN_PASSWORD=${out.admin.password}\n` +
    `E2E_VIEWER_EMAIL=${out.viewer.email}\n` +
    `E2E_VIEWER_PASSWORD=${out.viewer.password}\n` +
    `E2E_EMPLOYEE_EMAIL=${out.employee.email}\n` +
    `E2E_EMPLOYEE_PASSWORD=${out.employee.password}\n` +
    `E2E_FORCE_PW_EMAIL=${out.force_pw.email}\n` +
    `E2E_FORCE_PW_PASSWORD=${out.force_pw.password}\n` +
    `E2E_INACTIVE_EMAIL=${out.inactive.email}\n` +
    `E2E_INACTIVE_PASSWORD=${out.inactive.password}\n` +
    "E2E_OFFICE_IP=203.0.113.10\n" +
    "E2E_OFFICE_LAT=24.8607\n" +
    "E2E_OFFICE_LNG=67.0011\n" +
    "E2E_ALLOW_PUNCH=1\n"
);
