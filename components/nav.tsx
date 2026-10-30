"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavProps = {
  role: "ADMIN" | "EMPLOYEE";
  name: string;
};

const employeeLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/attendance", label: "History" },
  { href: "/profile", label: "Profile" },
];

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit-logs", label: "Audit" },
  { href: "/dashboard", label: "My Punch" },
];

export function AppNav({ role, name }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === "ADMIN" ? adminLinks : employeeLinks;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-bold tracking-tight text-teal-800">
            OfficePulse
          </p>
          <p className="text-xs text-slate-500">{name}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
              pathname === link.href || pathname.startsWith(link.href + "/")
                ? "bg-teal-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
