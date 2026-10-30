import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { ShiftsManager } from "@/components/admin/shifts-manager";
import type { Shift } from "@/types";

export default async function ShiftsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .order("start_time");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Shifts</h1>
        <ShiftsManager shifts={(shifts as Shift[]) ?? []} />
      </main>
    </div>
  );
}
