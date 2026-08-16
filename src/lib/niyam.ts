export type Program = "paryushan" | "das_lakshan";
export type AgeCategory = "0-5" | "6-8" | "9-11" | "12+";

export const AGE_CATEGORIES: AgeCategory[] = ["0-5", "6-8", "9-11", "12+"];

export const PROGRAMS: Record<
  Program,
  { label: string; start: string; days: number; countedDays: number }
> = {
  // Paryushan: 8 days (Sep 8 - Sep 15, 2026), all days counted
  paryushan: { label: "Paryushan", start: "2026-09-08", days: 8, countedDays: 8 },
  // Das Lakshan: 10 days (Sep 15 - Sep 24, 2026), best 8 days counted
  das_lakshan: { label: "Das Lakshan", start: "2026-09-15", days: 10, countedDays: 8 },
};

export type Activity = {
  key: string;
  label: string;
  kind: "do" | "dont";
  points: number;
  altPoints?: number;
  /** Ask which option was done. "always" = every day, "lastDay" = only the final day. */
  choice?: {
    when: "always" | "lastDay";
    title: string;
    baseLabel: string;
    altLabel: string;
    altShortLabel: string;
  };
};

export const MEAL_KEYS = ["2.1", "2.2", "2.3", "2.4", "2.5"];
export const UPVAAS_KEY = "2.5";
export const PLATE_KEY = "10";
export const CHAUVIHAAR_KEY = "11";

export const ACTIVITIES: Activity[] = [
  { key: "1", label: "Recite 8 navkar mantras on waking up", kind: "do", points: 20 },
  { key: "2.1", label: "Navkarsi (Breakfast 48 minutes after sunrise)", kind: "do", points: 30 },
  { key: "2.2", label: "Porasi (Breakfast 3 hours after sunrise)", kind: "do", points: 50 },
  {
    key: "2.3",
    label: "Besanu (Sit & eat 2 meals; boiled water sunrise to sunset)",
    kind: "do",
    points: 70,
  },
  {
    key: "2.4",
    label: "Ekasanu (Sit & eat 1 meal; boiled water sunrise to sunset)",
    kind: "do",
    points: 100,
  },
  { key: "2.5", label: "Upvaas (Boiled water sunrise to sunset)", kind: "do", points: 200 },
  { key: "3", label: "Bow to your parents/elders and get blessings", kind: "do", points: 20 },
  {
    key: "4",
    label: "Daily Darshan at temple (70 pts if kesar/vakshep pooja)",
    kind: "do",
    points: 50,
    altPoints: 70,
    choice: {
      when: "always",
      title: "What did you do at the temple?",
      baseLabel: "Darshan only (50 pts)",
      altLabel: "Kesar / Vakshep Pooja (70 pts)",
      altShortLabel: "Kesar",
    },
  },
  { key: "5", label: "1 navkar mala (Recite navkar mantra 108 times)", kind: "do", points: 70 },
  { key: "6", label: "Eat only Jain food all day (no root vegetables)", kind: "do", points: 100 },
  {
    key: "7",
    label: "48 min meditation/samayika/pratikraman/Shrimad Alochna (200 pts for Samvatsari)",
    kind: "do",
    points: 100,
    altPoints: 200,
    choice: {
      when: "lastDay",
      title: "Did you do Samvatsari pratikraman?",
      baseLabel: "Regular 48 min (100 pts)",
      altLabel: "Samvatsari pratikraman (200 pts)",
      altShortLabel: "Samvatsari",
    },
  },
  { key: "8", label: "Recite 8 navkar mantra before sleeping", kind: "do", points: 20 },
  {
    key: "9",
    label: "Donate $1 from your piggybank to a good cause (can donate later)",
    kind: "do",
    points: 30,
  },
  {
    key: "10",
    label: "Leave food on your plate (breakfast, lunch, dinner) — count if you did Upvaas",
    kind: "dont",
    points: 50,
  },
  {
    key: "11",
    label: "Eat after sunset until sunrise (Chauvihaar/Tivihaar) — count if Besanu/Ekasanu/Upvaas",
    kind: "dont",
    points: 100,
  },
  {
    key: "12",
    label: "Watch any screen for entertainment (video games/TV/smartphones)",
    kind: "dont",
    points: 80,
  },
  { key: "13", label: "Talk for 15 minutes (vow of silence)", kind: "dont", points: 50 },
];

export const ACTIVITY_BY_KEY: Record<string, Activity> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.key, a]),
);

export type Variant = "base" | "alt";
/** key format: `${dayIndex}|${activityKey}` */
export type SheetState = Record<string, Variant>;

export const cellKey = (day: number, activity: string) => `${day}|${activity}`;

export function programDays(program: Program): { index: number; date: Date }[] {
  const cfg = PROGRAMS[program];
  const [y, m, d] = cfg.start.split("-").map(Number);
  return Array.from({ length: cfg.days }, (_, i) => ({
    index: i,
    date: new Date(Date.UTC(y!, m! - 1, d! + i)),
  }));
}

export function formatDay(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const md = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
  return { weekday, md };
}

export function programRange(program: Program) {
  const days = programDays(program);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const last = days[days.length - 1]!.date;
  return `${fmt(days[0]!.date)} – ${fmt(last)}, ${last.getUTCFullYear()}`;
}

/** Applies the auto-check rules; returns the effective sheet plus which cells are forced. */
export function withAutoChecks(state: SheetState, program: Program) {
  const effective: SheetState = { ...state };
  const forced = new Set<string>();
  for (const { index } of programDays(program)) {
    const meal = MEAL_KEYS.find((k) => state[cellKey(index, k)]);
    if (!meal) continue;
    const chauvihaar = cellKey(index, CHAUVIHAAR_KEY);
    effective[chauvihaar] = "base";
    forced.add(chauvihaar);
    if (meal === UPVAAS_KEY) {
      const plate = cellKey(index, PLATE_KEY);
      effective[plate] = "base";
      forced.add(plate);
    }
  }
  return { effective, forced };
}

export function activityPoints(activityKey: string, variant: Variant) {
  const activity = ACTIVITY_BY_KEY[activityKey];
  if (!activity) return 0;
  return variant === "alt" && activity.altPoints ? activity.altPoints : activity.points;
}

export function dayPoints(state: SheetState, day: number) {
  let total = 0;
  for (const activity of ACTIVITIES) {
    const variant = state[cellKey(day, activity.key)];
    if (variant) total += activityPoints(activity.key, variant);
  }
  return total;
}

/** Per-day totals, the grand total, and which day indexes are dropped (Das Lakshan). */
export function scoreSheet(state: SheetState, program: Program) {
  const cfg = PROGRAMS[program];
  const perDay = programDays(program).map(({ index }) => ({
    index,
    points: dayPoints(state, index),
  }));
  const dropped = new Set<number>();
  if (perDay.length > cfg.countedDays) {
    const sorted = [...perDay].sort((a, b) => a.points - b.points || a.index - b.index);
    for (const d of sorted.slice(0, perDay.length - cfg.countedDays)) dropped.add(d.index);
  }
  const total = perDay.reduce((sum, d) => (dropped.has(d.index) ? sum : sum + d.points), 0);
  return { perDay, dropped, total };
}
