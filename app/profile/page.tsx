import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

        <Card className="space-y-3">
          <h2 className="font-semibold text-slate-900">Security</h2>
          <p className="text-sm text-slate-500">
            Change your password anytime. If you forgot it, ask an admin to
            reset a temporary password, then change it here after login.
          </p>
          <Link href="/change-password">
            <Button type="button" className="w-full sm:w-auto">
              Change password
            </Button>
          </Link>
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
