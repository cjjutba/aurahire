import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed `middleware` → `proxy`. Clerk auth runs here; fine-grained
// role gating lives in the portal layouts (they fetch the profile from the API).
const isPortalRoute = createRouteMatcher([
  "/candidate(.*)",
  "/recruiter(.*)",
  "/admin(.*)",
  "/onboarding(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPortalRoute(req)) {
    // Redirects unauthenticated users to NEXT_PUBLIC_CLERK_SIGN_IN_URL (/login).
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals + static assets, run on everything else
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Clerk's auto-proxy path
    "/__clerk/:path*",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
