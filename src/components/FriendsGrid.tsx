"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Friend } from "@/lib/queries";
import Avatar from "./Avatar";
import VerifiedName from "./VerifiedName";

const POLL_MS = 3000;

export default function FriendsGrid({ friends: initial }: { friends: Friend[] }) {
  // Re-fetched every few seconds so unread dots and new friends show up live.
  const [friends, setFriends] = useState(initial);
  useEffect(() => setFriends(initial), [initial]);
  useEffect(() => {
    const poll = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/friends");
        if (res.ok) setFriends((await res.json()).friends);
      } catch {
        // Try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  return (
    <section>
      <h2 className="mb-3 text-base font-normal">Aura friends</h2>
      {friends.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No friends yet. Search below to add your first one.
        </div>
      ) : (
        <ul className="grid grid-cols-4 gap-y-4">
          {friends.map((f) => (
            <li key={f.handle}>
              <Link href={`/chat/${f.handle}`} className="flex flex-col items-center gap-1.5 active:opacity-70">
                <span className="relative">
                  <Avatar name={f.name} seed={f.handle} size={54} />
                  {f.unread && (
                    <span
                      aria-label="Unread"
                      className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-bg bg-brand-light"
                    />
                  )}
                </span>
                <VerifiedName
                  name={f.name.split(" ")[0]}
                  verified={f.verified}
                  badgeSize={13}
                  className="w-full justify-center px-1 text-xs"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
