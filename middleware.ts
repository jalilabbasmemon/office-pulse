import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip static assets + PWA files so install/manifest checks are never
     * redirected to /login (that blocks "Install app" on mobile Chrome).
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|icons/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
