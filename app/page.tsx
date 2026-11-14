import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/session";

export default async function HomePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role === "ADMIN" || employee.role === "ADMIN_VIEWER") {
    redirect("/admin/dashboard");
  }
  redirect("/dashboard");
}
