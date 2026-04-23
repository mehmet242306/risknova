import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getDemoAccessState } from "@/lib/platform-admin/demo-access";

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/auth");
  const mustChangePassword = user?.user_metadata?.must_change_password === true;
  const demoAccess = getDemoAccessState({
    userMetadata: user?.user_metadata,
    appMetadata: user?.app_metadata,
  });
  const canBypassForcedReset =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname === "/reset-password";
  const canBypassDemoGuard =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && demoAccess.isBlocked && !canBypassDemoGuard) {
    const errorMessage =
      demoAccess.status === "disabled"
        ? "Demo erisimi admin tarafindan engellendi."
        : "Demo erisim suresi doldu. Lutfen yeni demo erisimi isteyin.";

    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          error: errorMessage,
          code: "DEMO_ACCESS_BLOCKED",
        },
        { status: 423 },
      );
    }

    // Süresi dolmuş demo kullanıcısını /login'e atıp hata toast'ı göstermek
    // yerine /register'a yönlendir — teşekkür + CTA banner'ı ile kayıt akışına
    // dönüştür. /register canBypassDemoGuard'a eklendi, yoksa loop olurdu.
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    url.searchParams.set(
      "fromDemo",
      demoAccess.status === "disabled" ? "demo-disabled" : "demo-expired",
    );
    return NextResponse.redirect(url);
  }

  if (user && mustChangePassword && !canBypassForcedReset) {
    const url = request.nextUrl.clone();
    url.pathname = "/reset-password";
    url.searchParams.set("required", "1");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
