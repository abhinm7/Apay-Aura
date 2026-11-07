import { notFound, redirect } from "next/navigation";
import { getBet, getUserById } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import BetView from "./BetView";

export const dynamic = "force-dynamic";

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUserId();
  const user = me ? await getUserById(me) : null;
  if (!user) redirect("/api/auth/logout");

  const { id } = await params;
  const bet = /^\d+$/.test(id) ? await getBet(user.id, id) : null;
  if (!bet) notFound();

  return (
    <BetView
      initial={bet}
      me={{ name: user.name, handle: user.handle, verified: user.verified, avatarUrl: user.avatarUrl }}
      hasPin={user.hasPin}
    />
  );
}
