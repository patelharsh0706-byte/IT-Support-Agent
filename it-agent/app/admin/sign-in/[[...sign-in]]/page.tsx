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
            href="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in as customer
          </Link>
        </>
      }
    >
      {/* CSR accounts are provisioned by an admin (Clerk Dashboard / `clerk
          users`), never self-registered — the sign-up prompt is hidden. */}
      <SignIn appearance={{ elements: { footerAction: { display: "none" } } }} />
    </AuthSplitLayout>
  );
}
