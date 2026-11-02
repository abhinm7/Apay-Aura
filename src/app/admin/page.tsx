import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin";
import { listBanks, loanCountsByBank } from "@/lib/queries";
import AdminLogin from "./AdminLogin";
import AdminView from "./AdminView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "apay admin", robots: { index: false, follow: false } };

// Not linked from anywhere: open /admin directly and enter the admin PIN. No user login needed.
export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const [banks, counts] = await Promise.all([listBanks(), loanCountsByBank()]);
  return <AdminView banks={banks} counts={counts} />;
}
