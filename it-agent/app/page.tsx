import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;

  redirect(role === "csr" ? "/admin" : "/customer/dashboard");
}
