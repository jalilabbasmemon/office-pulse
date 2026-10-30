import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "@/components/admin/employee-form";
import type { Shift } from "@/types";

export default async function NewEmployeePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .eq("status", "ACTIVE")
    .order("start_time");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Card className="space-y-4">
          <CardTitle>Create employee</CardTitle>
          <EmployeeForm shifts={(shifts as Shift[]) ?? []} />
        </Card>
      </main>
    </div>
  );
}
