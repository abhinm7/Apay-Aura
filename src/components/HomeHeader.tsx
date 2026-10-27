import { auraId } from "@/lib/validate";
import Avatar from "./Avatar";
import VerifiedName from "./VerifiedName";

export default function HomeHeader({ name, handle, verified }: { name: string; handle: string; verified: boolean }) {
  return (
    <header className="flex items-center gap-3">
      <Avatar name={name} seed={handle} size={42} />
      <div className="min-w-0 flex-1">
        <VerifiedName name={`Hi, ${name.split(" ")[0]}`} verified={verified} className="text-[15px] font-semibold" />
        <p className="truncate text-xs text-muted">{auraId(handle)}</p>
      </div>
    </header>
  );
}
