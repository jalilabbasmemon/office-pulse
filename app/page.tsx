import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/session";

export default async function HomePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role === "ADMIN") redirect("/admin/dashboard");
  redirect("/dashboard");
}
