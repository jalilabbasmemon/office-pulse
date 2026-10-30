import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { OfficeSettingsForm } from "@/components/admin/office-settings-form";
import type { OfficeSettings } from "@/types";

export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("office_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Card className="space-y-4">
          <CardTitle>Office settings</CardTitle>
          <p className="text-sm text-slate-500">
            Attendance is only accepted from the office public IP and within the
            configured GPS radius.
          </p>
          <OfficeSettingsForm settings={(settings as OfficeSettings) ?? null} />
        </Card>
      </main>
    </div>
  );
}
