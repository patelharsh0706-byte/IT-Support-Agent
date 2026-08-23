import { auth } from "@clerk/nextjs/server";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * The CSR door's landing page. A `csr` session goes straight through to the
 * console; anyone else signed in through this door lands here and is told
 * why they cannot continue, rather than being silently dropped on the
 * customer dashboard.
 */
export default async function AdminHome() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;

  if (role === "csr") {
    redirect("/admin/conversations");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-state-pending/10 text-state-pending">
          <ShieldAlert className="size-5" />
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-[22px] font-semibold text-foreground">
            This isn&apos;t a CSR account
          </h1>
          <p className="text-[15px] text-muted-foreground">
            You&apos;re signed in, but the CSR console is only available to
            Customer Service Representatives. CSR access is granted by an
            administrator — it can&apos;t be self-enabled.
          </p>
        </div>

        <div className="mt-1 flex flex-col gap-2 self-stretch">
          <Button asChild>
            <Link href="/customer/dashboard">Go to your dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/sign-in">Sign in with a CSR account</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
