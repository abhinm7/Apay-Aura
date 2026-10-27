import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import VerifiedName from "@/components/VerifiedName";
import { BackIcon } from "@/components/icons";
import { listPayments, type Payment } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import { TAX_PERCENT } from "@/lib/tax";

export const dynamic = "force-dynamic";

// Server-rendered, so use a fixed locale/zone to keep dates stable.
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function groupByDay(payments: Payment[]) {
  const groups: { day: string; items: Payment[] }[] = [];
  for (const p of payments) {
    const day = dayFmt.format(new Date(p.createdAt));
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(p);
    else groups.push({ day, items: [p] });
  }
  return groups;
}

export default async function HistoryPage() {
  const me = await currentUserId();
  if (!me) redirect("/login");
  const payments = await listPayments(me);

  return (
    <main className="min-h-dvh pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link href="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
          <BackIcon />
        </Link>
        <h1 className="text-[17px] font-semibold">History</h1>
      </header>

      {payments.length === 0 ? (
        <p className="px-6 pt-20 text-center text-sm text-muted">No payments yet. Aura you send or receive will show up here.</p>
      ) : (
        <div className="px-4">
          {groupByDay(payments).map((g) => (
            <section key={g.day}>
              <h2 className="pt-5 pb-2 text-xs font-medium text-muted">{g.day}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {g.items.map((p) => (
                  <li key={p.id}>
                    <Link href={`/chat/${p.other.handle}`} className="flex items-center gap-3 px-4 py-3 active:bg-line">
                      <Avatar name={p.other.name} seed={p.other.handle} size={40} />
                      <div className="min-w-0 flex-1">
                        <VerifiedName name={p.other.name} verified={p.other.verified} className="text-[15px] font-medium" />
                        <p className="truncate text-xs text-muted">
                          {p.sent ? "Sent" : "Received"} · {timeFmt.format(new Date(p.createdAt))}
                          {p.note && ` · ${p.note}`}
                        </p>
                      </div>
                      {/* Sent shows what left your balance, received what arrived (after tax). */}
                      <div className="shrink-0 text-right">
                        <p className={`text-[15px] font-semibold tabular-nums ${p.sent ? "text-danger" : "text-success"}`}>
                          {p.sent ? "−" : "+"} {(p.sent ? p.amount : p.amount - p.tax).toLocaleString("en-IN")} ✦
                        </p>
                        {p.tax > 0 && (
                          <p className="text-[11px] text-muted tabular-nums">
                            {TAX_PERCENT}% tax {p.tax.toLocaleString("en-IN")} ✦
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
