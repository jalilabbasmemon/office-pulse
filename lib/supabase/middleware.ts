import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminHomePath } from "@/lib/auth/roles";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

type EmpGate = {
  status: string;
  must_change_password: boolean | null;
  role: string;
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // PWA install needs these without a session (Chrome fetches manifest anonymously).
  const isPublicAsset =
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    path.startsWith("/icons/") ||
    path.startsWith("/brand/");

  const isAuthCallback = path.startsWith("/api/auth");
  const isLogin = path === "/login";
  const isChangePassword =
    path === "/change-password" ||
    path.startsWith("/api/account/change-password");

  if (!user) {
    if (
      isPublicAsset ||
      isAuthCallback ||
      isLogin ||
      path === "/" ||
      path.startsWith("/_next")
    ) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Authenticated: load identity row (status + password gate + role)
  const { data: emp } = await supabase
    .from("employees")
    .select("status, must_change_password, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const gate = emp as EmpGate | null;

  const redirectToLogin = async () => {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (!gate || gate.status !== "ACTIVE") {
    // Kill stale sessions for missing / deactivated accounts
    if (isPublicAsset || isAuthCallback) return supabaseResponse;
    return redirectToLogin();
  }

  if (gate.must_change_password && !isChangePassword && !isPublicAsset) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message:
            "You must change your temporary password before continuing.",
        },
        { status: 403 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "forced=1";
    return NextResponse.redirect(url);
  }

  if (isLogin || path === "/") {
    const url = request.nextUrl.clone();
    if (gate.must_change_password) {
      url.pathname = "/change-password";
      url.search = "forced=1";
    } else {
      url.pathname = adminHomePath(gate.role);
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
