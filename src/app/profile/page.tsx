import { redirect } from "next/navigation";
import { getProfile, getUserById, MAX_AURA_IDS } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import ProfileView from "./ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await currentUserId();
  const [profile, user] = me ? await Promise.all([getProfile(me), getUserById(me)]) : [null, null];
  if (!profile || !user) redirect("/api/auth/logout");

  return <ProfileView profile={profile} hasPin={user.hasPin} maxAuraIds={MAX_AURA_IDS} />;
}
