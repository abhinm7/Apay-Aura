import { notFound, redirect } from "next/navigation";
import { getUserByHandle, getUserById, listMessages, markRead } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import ChatView from "./ChatView";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const me = await currentUserId();
  const user = me ? await getUserById(me) : null;
  if (!user) redirect("/api/auth/logout");

  const { handle } = await params;
  const { pay } = await searchParams;
  const friend = await getUserByHandle(handle);
  if (!friend) notFound();
  if (friend.id === user.id) redirect("/");
  // Reached through one of their extra Aura IDs: use the main one, so each person has one chat URL.
  if (friend.handle !== handle.toLowerCase()) redirect(`/chat/${friend.handle}${pay === "1" ? "?pay=1" : ""}`);

  const [messages] = await Promise.all([listMessages(user.id, friend.id), markRead(user.id, friend.id)]);

  return (
    <ChatView
      friend={{ name: friend.name, handle: friend.handle, verified: friend.verified }}
      hasPin={user.hasPin}
      initialMessages={messages}
      openPay={pay === "1"}
    />
  );
}
