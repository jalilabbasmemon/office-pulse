import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EmployeesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const supabase = await createClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("*, shifts(name)")
    .order("employee_id");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <Link href="/admin/employees/new">
            <Button>Add employee</Button>
          </Link>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Designation</th>
                  <th className="px-4 py-2">Shift</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(employees ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.employee_id}
                    </td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3">{e.designation}</td>
                    <td className="px-4 py-3">{e.shifts?.name ?? "--"}</td>
                    <td className="px-4 py-3">{e.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          e.status === "ACTIVE"
                            ? "text-teal-700"
                            : "text-slate-400"
                        }
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/employees/${e.id}`}
                        className="text-teal-700 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
