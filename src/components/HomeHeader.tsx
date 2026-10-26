"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { disablePush } from "@/lib/pushClient";
import { auraId } from "@/lib/validate";
import Avatar from "./Avatar";
import { LogoutIcon } from "./icons";
import VerifiedName from "./VerifiedName";

export default function HomeHeader({ name, handle, verified }: { name: string; handle: string; verified: boolean }) {
  const router = useRouter();

  async function logout() {
    await disablePush().catch(() => {});
    await api("/api/auth/logout", {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-3">
      <Avatar name={name} seed={handle} size={42} />
      <div className="min-w-0 flex-1">
        <VerifiedName name={`Hi, ${name.split(" ")[0]}`} verified={verified} className="text-[15px] font-semibold" />
        <p className="truncate text-xs text-muted">{auraId(handle)}</p>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="Sign out"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-line"
      >
        <LogoutIcon width={20} height={20} />
      </button>
    </header>
  );
}
