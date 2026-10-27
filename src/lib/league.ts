// Aura leagues: your level, based on how much aura you hold.
export const LEAGUES = [
  { key: "rookie", name: "Aura Rookie", short: "Rookie", min: 0, tagline: "Every legend starts somewhere" },
  { key: "seeker", name: "Aura Seeker", short: "Seeker", min: 5_000, tagline: "The hunt for aura begins" },
  { key: "farmer", name: "Aura Farmer", short: "Farmer", min: 10_000, tagline: "Harvesting aura daily" },
  { key: "master", name: "Aura Master", short: "Master", min: 100_000, tagline: "Aura bends to your will" },
  { key: "overlord", name: "Aura Overlord", short: "Overlord", min: 500_000, tagline: "Ruler of the aura realm" },
  { key: "god", name: "Aura God", short: "God", min: 1_000_000, tagline: "Beyond mortal aura" },
] as const;

export type LeagueKey = (typeof LEAGUES)[number]["key"];

// What the page gets: the league and the gap to the next one, not the raw balance.
export type LeagueStatus = {
  index: number;
  // Aura still needed for the next league; null at the top.
  toNext: number | null;
  // 0–1 progress from this league's floor to the next one's.
  progress: number;
};

export function leagueStatus(balance: number): LeagueStatus {
  let index = 0;
  while (index + 1 < LEAGUES.length && balance >= LEAGUES[index + 1].min) index++;
  const next = LEAGUES[index + 1];
  if (!next) return { index, toNext: null, progress: 1 };
  const floor = LEAGUES[index].min;
  return { index, toNext: next.min - balance, progress: (balance - floor) / (next.min - floor) };
}
