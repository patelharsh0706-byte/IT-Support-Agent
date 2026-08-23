import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/customer/sign-in(.*)",
  "/sign-up(.*)",
  "/admin/sign-in(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    const signInPath = isAdminRoute(req) ? "/admin/sign-in" : "/customer/sign-in";
    return NextResponse.redirect(new URL(signInPath, req.url));
  }

  if (isAdminRoute(req)) {
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    // `/admin` itself is the CSR door's landing page: it is reachable by any
    // signed-in user so it can explain the mismatch when a customer signs in
    // through the wrong door. Every admin surface below it stays 404-gated,
    // so the console itself is still never advertised.
    const isAdminLanding = req.nextUrl.pathname === "/admin";
    if (role !== "csr" && !isAdminLanding) {
      return NextResponse.rewrite(new URL("/404", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
