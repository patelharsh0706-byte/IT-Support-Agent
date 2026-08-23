import { SignIn } from "@clerk/nextjs";
import { UserRound } from "lucide-react";
import Link from "next/link";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export const metadata = {
  title: "Customer sign in · Amex Service",
};

export default function SignInPage() {
  return (
    <AuthSplitLayout
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-primary">
          <UserRound className="size-4" />
          Customer
        </span>
      }
      footnote={
        <>
          Customer Service Representative?{" "}
          <Link
            href="/admin/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in as CSR
          </Link>
        </>
      }
    >
      <SignIn />
    </AuthSplitLayout>
  );
}
