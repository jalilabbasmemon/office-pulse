/**
 * Server-side QA fixture utilities (Node only).
 * Reads SUPABASE_SECRET_KEY from .env.qa.local / E2E_QA_SUPABASE_SECRET_KEY.
 * Never import this into browser/page scripts.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadQaLocal(): Record<string, string> {
  const file = path.join(process.cwd(), ".env.qa.local");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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
    out[m[1]] = v;
  }
  return out;
}

export function getQaAdminClientOrNull() {
  const local = loadQaLocal();
  const url =
    local.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.E2E_QA_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const secret =
    local.SUPABASE_SECRET_KEY ||
    process.env.E2E_QA_SUPABASE_SECRET_KEY ||
    "";
  if (!url || /jniyfhpwrjofdljqsdwd/i.test(url)) return null;
  if (!secret || secret.length < 20 || /placeholder/i.test(secret)) return null;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Clear today's attendance for disposable QA employee (setup only). */
export async function resetQaEmployeeTodayAttendance(
  employeeCode = "QAEMP01"
): Promise<{ ok: boolean; reason?: string }> {
  const db = getQaAdminClientOrNull();
  if (!db) return { ok: false, reason: "no_qa_admin_client" };
  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("employee_id", employeeCode)
    .maybeSingle();
  if (!emp?.id) return { ok: false, reason: "employee_not_found" };
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Karachi",
  });
  const { error } = await db
    .from("attendance")
    .delete()
    .eq("employee_id", emp.id)
    .eq("attendance_date", day);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
