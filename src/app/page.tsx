import { redirect } from "next/navigation";
import { Wordmark } from "@/components/AuthShell";
import BalanceCard from "@/components/BalanceCard";
import FriendSearch from "@/components/FriendSearch";
import FriendsGrid from "@/components/FriendsGrid";
import HomeHeader from "@/components/HomeHeader";
import NotificationPrompt from "@/components/NotificationPrompt";
import { getUserById, listFriends } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function Divider() {
  return <hr className="mx-auto w-1/3 border-0 border-t border-line" />;
}

export default async function Home() {
  const me = await currentUserId();
  const user = me ? await getUserById(me) : null;
  if (!user) redirect("/api/auth/logout");

  const friends = await listFriends(user.id);

  return (
    <main className="flex flex-col gap-7 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <div className="flex items-center justify-between">
        <Wordmark />
      </div>
      <HomeHeader name={user.name} handle={user.handle} verified={user.verified} />
      <BalanceCard hasPin={user.hasPin} />
      <NotificationPrompt />
      <Divider />
      <FriendsGrid friends={friends} />
      <Divider />
      <FriendSearch />
    </main>
  );
}
