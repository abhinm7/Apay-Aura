import { redirect } from "next/navigation";
import { MAX_BALANCE_MULTIPLE } from "@/lib/loans";
import { getLoanEligibility, getUserById, listBanks, listLoans, settleLoans } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import LoansView from "./LoansView";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const me = await currentUserId();
  const user = me ? await getUserById(me) : null;
  if (!user) redirect("/api/auth/logout");

  await settleLoans(user.id);
  const [banks, loans, eligibility] = await Promise.all([listBanks(), listLoans(user.id), getLoanEligibility(user.id)]);

  return (
    <LoansView
      banks={banks}
      loans={loans}
      limit={(eligibility?.balance ?? 0) * MAX_BALANCE_MULTIPLE}
      verified={user.verified}
      hasPin={user.hasPin}
    />
  );
}
