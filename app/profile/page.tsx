import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";

export default async function ProfilePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");

  const shift = employee.shifts;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold text-slate-900">Profile</h1>
        <Card className="space-y-4">
          <Field label="Employee ID" value={employee.employee_id} />
          <Field label="Name" value={employee.name} />
          <Field label="Mobile" value={employee.mobile} />
          <Field label="Designation" value={employee.designation} />
          <Field label="Role" value={employee.role} />
          <Field
            label="Shift"
            value={
              shift
                ? `${shift.name} (${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)})`
                : "Not assigned"
            }
          />
          <Field label="Status" value={employee.status} />
        </Card>
        <p className="text-xs text-slate-500">
          Profile details can only be updated by an administrator.
        </p>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-900">{value}</p>
    </div>
  );
}
