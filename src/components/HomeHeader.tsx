import type { LeagueStatus } from "@/lib/league";
import { auraId } from "@/lib/validate";
import Avatar from "./Avatar";
import LeagueBadge from "./LeagueBadge";
import VerifiedName from "./VerifiedName";

export default function HomeHeader({
  name,
  handle,
  verified,
  league,
}: {
  name: string;
  handle: string;
  verified: boolean;
  league: LeagueStatus;
}) {
  return (
    <header className="flex items-center gap-3">
      <Avatar name={name} seed={handle} size={42} />
      <div className="min-w-0 flex-1">
        <VerifiedName name={`Hi, ${name.split(" ")[0]}`} verified={verified} className="text-[15px] font-semibold" />
        <p className="truncate text-xs text-muted">{auraId(handle)}</p>
      </div>
      <LeagueBadge status={league} />
    </header>
  );
}
