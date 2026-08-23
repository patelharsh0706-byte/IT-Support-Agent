import { SignIn } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export const metadata = {
  title: "CSR sign in · Amex Service",
};

export default function CSRSignInPage() {
  return (
    <AuthSplitLayout
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-primary">
          <ShieldCheck className="size-4" />
          CSR
        </span>
      }
      footnote={
        <>
          Not a CSR?{" "}
          <Link
            href="/customer/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in as customer
          </Link>
        </>
      }
    >
      {/* CSR accounts are provisioned by an admin (Clerk Dashboard / `clerk
          users`), never self-registered — the sign-up prompt is hidden.
          Lands on `/admin` rather than `/` so a non-CSR signing in through
          this door gets told why, instead of being silently redirected to
          the customer dashboard. */}
      <SignIn
        fallbackRedirectUrl="/admin"
        appearance={{ elements: { footerAction: { display: "none" } } }}
      />
    </AuthSplitLayout>
  );
}
