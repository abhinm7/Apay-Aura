"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { auraId } from "@/lib/validate";
import Avatar from "./Avatar";
import { CheckIcon, PlusIcon, SearchIcon } from "./icons";
import VerifiedName from "./VerifiedName";

type Result = { name: string; handle: string; verified: boolean; isFriend: boolean };

export default function FriendSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api<{ users: Result[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
        setResults(res.users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function add(handle: string) {
    setAdding(handle);
    try {
      await api("/api/friends", { handle });
      setResults((rs) => rs.map((r) => (r.handle === handle ? { ...r, isFriend: true } : r)));
      router.refresh();
    } finally {
      setAdding(null);
    }
  }

  const query = q.trim();

  return (
    <section>
      <h2 className="mb-3 text-base font-normal">Add aura friends</h2>
      <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
        <SearchIcon className="text-muted" width={18} height={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, Aura ID or phone"
          className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
          autoComplete="off"
          autoCapitalize="none"
          enterKeyHint="search"
        />
      </label>

      {query.length >= 2 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {loading && results.length === 0 && <li className="px-4 py-4 text-sm text-muted">Searching…</li>}
          {!loading && results.length === 0 && (
            <li className="px-4 py-4 text-sm text-muted">No one found for “{query}”</li>
          )}
          {results.map((r) => (
            <li key={r.handle} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/chat/${r.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={r.name} seed={r.handle} size={40} />
                <div className="min-w-0">
                  <VerifiedName name={r.name} verified={r.verified} className="text-[15px] font-medium" />
                  <p className="truncate text-xs text-muted">{auraId(r.handle)}</p>
                </div>
              </Link>
              {r.isFriend ? (
                <Link
                  href={`/chat/${r.handle}`}
                  className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
                >
                  <CheckIcon width={16} height={16} /> Friend
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => add(r.handle)}
                  disabled={adding === r.handle}
                  className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-60"
                >
                  <PlusIcon width={16} height={16} /> Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
