import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PORTAL_PREFIXES = {
  candidate: "/candidate",
  recruiter: "/recruiter",
  admin: "/admin",
} as const;

// Auth ROUTES that redirect authenticated users away.
// Note: /verify-email and /reset-password are NOT in this list because they are
// Supabase auth-callback routes that must work even with an active session.
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPortalRoute =
    pathname.startsWith(PORTAL_PREFIXES.candidate) ||
    pathname.startsWith(PORTAL_PREFIXES.recruiter) ||
    pathname.startsWith(PORTAL_PREFIXES.admin) ||
    pathname.startsWith("/onboarding");

  const isAuthRoute = AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Unauthenticated user trying to access portal → /login
  if (!user && isPortalRoute) {
    const url = new URL("/login", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user trying to access auth routes → their portal
  // Sprint trade-off: send to /candidate; the page itself can re-route based on role.
  // Phase 2: encode role in JWT custom claims and route directly.
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/candidate", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)",
  ],
};
