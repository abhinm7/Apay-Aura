import { notFound, redirect } from "next/navigation";
import { getUserByHandle, getUserById, listMessages } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import ChatView from "./ChatView";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ handle: string }> }) {
  const me = await currentUserId();
  const user = me ? await getUserById(me) : null;
  if (!user) redirect("/api/auth/logout");

  const friend = await getUserByHandle((await params).handle);
  if (!friend) notFound();
  if (friend.id === user.id) redirect("/");

  const messages = await listMessages(user.id, friend.id);

  return (
    <ChatView
      friend={{ name: friend.name, handle: friend.handle, verified: friend.verified }}
      hasPin={user.hasPin}
      initialMessages={messages}
    />
  );
}
