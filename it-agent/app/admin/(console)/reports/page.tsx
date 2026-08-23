import { redirect } from "next/navigation";

export default function ReportsHome() {
  redirect("/admin/reports/dashboard");
}
