import { redirect } from "next/navigation";
import type { Employee } from "@/types";

export function redirectIfMustChangePassword(employee: Employee) {
  if (employee.must_change_password) {
    redirect("/change-password?forced=1");
  }
}
