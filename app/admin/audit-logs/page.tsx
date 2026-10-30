import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function AuditLogsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, admin:admin_id(name, employee_id)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Audit logs</h1>
        <Card className="divide-y divide-slate-100 p-0">
          {(logs ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No audit events yet.
            </p>
          )}
          {(logs ?? []).map((log) => (
            <div key={log.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{log.action}</p>
                <p className="text-xs text-slate-400">
                  {formatDate(log.created_at)}
                </p>
              </div>
              <p className="text-slate-600">
                {(log.admin as { name?: string } | null)?.name ?? "Admin"} ·{" "}
                {log.entity_type}
              </p>
              {log.reason && (
                <p className="text-slate-500">Reason: {log.reason}</p>
              )}
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}
