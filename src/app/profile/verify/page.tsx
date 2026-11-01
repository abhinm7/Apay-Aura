import { redirect } from "next/navigation";
import { getProfile, getUserById } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import VerifyView from "./VerifyView";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const me = await currentUserId();
  const [profile, user] = me ? await Promise.all([getProfile(me), getUserById(me)]) : [null, null];
  if (!profile || !user) redirect("/api/auth/logout");

  return (
    <VerifyView
      name={profile.name}
      handle={profile.handle}
      avatarUrl={profile.avatarUrl}
      verified={profile.verified}
      hasPin={user.hasPin}
    />
  );
}
