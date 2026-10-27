"use client";

import { Compass, Crown, Flame, Sprout, Wheat, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { LEAGUES, type LeagueKey, type LeagueStatus } from "@/lib/league";
import Sheet from "./Sheet";

const ICON: Record<LeagueKey, LucideIcon> = {
  rookie: Sprout,
  seeker: Compass,
  farmer: Wheat,
  master: Zap,
  overlord: Crown,
  god: Flame,
};

// Static class names per league (Tailwind needs them spelled out).
const TONE: Record<LeagueKey, { text: string; pill: string; dot: string }> = {
  rookie: {
    text: "text-league-rookie",
    pill: "bg-league-rookie/12 text-league-rookie",
    dot: "bg-league-rookie",
  },
  seeker: {
    text: "text-league-seeker",
    pill: "bg-league-seeker/12 text-league-seeker",
    dot: "bg-league-seeker",
  },
  farmer: {
    text: "text-league-farmer",
    pill: "bg-league-farmer/12 text-league-farmer",
    dot: "bg-league-farmer",
  },
  master: {
    text: "text-league-master",
    pill: "bg-league-master/12 text-league-master",
    dot: "bg-league-master",
  },
  overlord: {
    text: "text-league-overlord",
    pill: "bg-league-overlord/12 text-league-overlord",
    dot: "bg-league-overlord",
  },
  god: {
    text: "text-league-god",
    pill: "bg-league-god/12 text-league-god",
    dot: "bg-league-god",
  },
};

// Top leagues get special animated badges (styles in globals.css).
const SPECIAL: Partial<Record<LeagueKey, { pill: string; text: string }>> = {
  god: { pill: "breathe breathe-gold", text: "metal-text" },
  overlord: { pill: "breathe breathe-silver", text: "metal-text" },
};

const fmt = (n: number) => n.toLocaleString("en-IN");

export default function LeagueBadge({ status }: { status: LeagueStatus }) {
  const [open, setOpen] = useState(false);
  const league = LEAGUES[status.index];
  const next = LEAGUES[status.index + 1];
  const tone = TONE[league.key];
  const special = SPECIAL[league.key];
  const percent = Math.floor(status.progress * 100);
  const Icon = ICON[league.key];

  // Fill the progress bar from 0 each time the sheet opens.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!open) return setFilled(false);
    const t = setTimeout(() => setFilled(true), 150);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${league.name} — see leagues`}
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase active:opacity-70 ${special ? special.pill : tone.pill}`}
      >
        <span className={special?.text}>✦ {league.short}</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <h2 className="text-center text-lg font-semibold">Aura Leagues</h2>

        {/* Your league */}
        <div className="mt-6 text-center">
          <Icon size={32} strokeWidth={1.75} className={`mx-auto ${tone.text}`} aria-hidden />
          <p className={`mt-2 text-xl font-semibold ${tone.text}`}>{league.name}</p>
          <p className="text-sm text-muted">{league.tagline}</p>
        </div>

        {next && status.toNext !== null ? (
          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-out ${tone.dot}`}
                style={{ width: filled ? `${Math.max(2, percent)}%` : "0%" }}
              />
            </div>
            <p className="mt-2 text-center text-sm text-muted">
              <span className="font-medium text-ink tabular-nums">✦ {fmt(status.toNext)}</span> to {next.name}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted">You&apos;re at the top.</p>
        )}

        {/* All leagues, top first */}
        <ol className="mt-8 mb-1">
          {LEAGUES.map((l, i) => ({ l, i }))
            .reverse()
            .map(({ l, i }, row) => {
              const reached = i <= status.index;
              const current = i === status.index;
              const RowIcon = ICON[l.key];
              const last = row === LEAGUES.length - 1;
              return (
                <li key={l.key} className="flex gap-3">
                  {/* Track: icon, then a line down to the league below (colored once you've passed it) */}
                  <div className="flex w-5 flex-col items-center">
                    <RowIcon
                      size={18}
                      strokeWidth={1.75}
                      className={`mt-0.5 shrink-0 ${reached ? TONE[l.key].text : "text-muted opacity-40"}`}
                      aria-hidden
                    />
                    {!last && <span className={`my-1.5 min-h-4 w-px flex-1 ${reached ? TONE[l.key].dot : "bg-line"}`} />}
                  </div>
                  <div className={`flex flex-1 items-start justify-between ${last ? "" : "pb-5"}`}>
                    <p className={`text-[15px] ${current ? "font-semibold" : reached ? "" : "text-muted"}`}>{l.name}</p>
                    <p className="pt-0.5 text-xs text-muted tabular-nums">
                      {current ? "You" : LEAGUES[i + 1] ? `✦ ${fmt(l.min)}` : `✦ ${fmt(l.min)}+`}
                    </p>
                  </div>
                </li>
              );
            })}
        </ol>
      </Sheet>
    </>
  );
}
