import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "@/components/admin/employee-form";
import type { Employee, Shift } from "@/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditEmployeePage({ params }: Props) {
  const current = await getCurrentEmployee();
  if (!current) redirect("/login");
  if (current.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: employee }, { data: shifts }] = await Promise.all([
    supabase.from("employees").select("*, shifts(*)").eq("id", id).maybeSingle(),
    supabase.from("shifts").select("*").eq("status", "ACTIVE").order("start_time"),
  ]);

  if (!employee) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={current.role} name={current.name} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Card className="space-y-4">
          <CardTitle>Edit {employee.name}</CardTitle>
          <EmployeeForm
            employee={employee as Employee}
            shifts={(shifts as Shift[]) ?? []}
          />
        </Card>
      </main>
    </div>
  );
}
