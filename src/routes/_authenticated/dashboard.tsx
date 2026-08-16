import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Pencil, Plus, Save, Shield, Trophy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KidFields, emptyKid, type KidDraft } from "@/components/kid-fields";
import {
  ACTIVITIES,
  ACTIVITY_BY_KEY,
  MEAL_KEYS,
  PROGRAMS,
  cellKey,
  formatDay,
  programDays,
  programRange,
  scoreSheet,
  withAutoChecks,
  type AgeCategory,
  type Program,
  type SheetState,
  type Variant,
} from "@/lib/niyam";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Niyam sheet — JSGA Niyam Tracker" },
      {
        name: "description",
        content: "Fill in your kid's daily Paryushan or Das Lakshan niyam sheet and see standings.",
      },
      { property: "og:title", content: "Niyam sheet — JSGA Niyam Tracker" },
      { property: "og:description", content: "Your kids' daily niyam sheet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type Kid = {
  id: string;
  name: string;
  age_category: AgeCategory;
  program: Program;
  created_at: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kidDialog, setKidDialog] = useState<null | { mode: "add" | "edit"; draft: KidDraft }>(null);
  const [choice, setChoice] = useState<null | { day: number; activityKey: string }>(null);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });

  const { data: kids = [] } = useQuery({
    queryKey: ["kids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids")
        .select("id, name, age_category, program, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Kid[];
    },
  });

  const selectedKid = kids.find((kid) => kid.id === selectedKidId) ?? kids[0] ?? null;

  useEffect(() => {
    if (!selectedKidId && kids[0]) setSelectedKidId(kids[0].id);
  }, [kids, selectedKidId]);

  const { data: entries } = useQuery({
    queryKey: ["entries", selectedKid?.id],
    enabled: Boolean(selectedKid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kid_entries")
        .select("day_index, activity_key, variant")
        .eq("kid_id", selectedKid!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!entries) return;
    const next: SheetState = {};
    for (const entry of entries) {
      next[cellKey(entry.day_index, entry.activity_key)] = (entry.variant as Variant) ?? "base";
    }
    setSheet(next);
    setDirty(false);
  }, [entries, selectedKid?.id]);

  const { data: totals = {} } = useQuery({
    queryKey: ["totals", kids.map((k) => k.id).join(",")],
    enabled: kids.length > 0,
    queryFn: async () => {
      const result: Record<string, number> = {};
      for (const kid of kids) {
        const { data } = await supabase.rpc("kid_points", { _kid: kid.id });
        result[kid.id] = data ?? 0;
      }
      return result;
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard", selectedKid?.age_category],
    enabled: Boolean(selectedKid),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard", {
        _age: selectedKid!.age_category,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const program = selectedKid?.program ?? "paryushan";
  const days = useMemo(() => programDays(program), [program]);
  const lastDayIndex = days.length - 1;
  const { effective, forced } = useMemo(() => withAutoChecks(sheet, program), [sheet, program]);
  const { perDay, dropped, total } = useMemo(
    () => scoreSheet(effective, program),
    [effective, program],
  );

  function setCell(day: number, activityKey: string, variant: Variant | null) {
    setSheet((prev) => {
      const next = { ...prev };
      if (variant === null) {
        delete next[cellKey(day, activityKey)];
      } else {
        if (MEAL_KEYS.includes(activityKey)) {
          for (const key of MEAL_KEYS) delete next[cellKey(day, key)];
        }
        next[cellKey(day, activityKey)] = variant;
      }
      return next;
    });
    setDirty(true);
  }

  function toggleCell(day: number, activityKey: string) {
    const activity = ACTIVITY_BY_KEY[activityKey]!;
    const current = sheet[cellKey(day, activityKey)];
    if (current) {
      setCell(day, activityKey, null);
      return;
    }
    const needsChoice =
      activity.choice &&
      (activity.choice.when === "always" ||
        (activity.choice.when === "lastDay" && day === lastDayIndex));
    if (needsChoice) {
      setChoice({ day, activityKey });
      return;
    }
    setCell(day, activityKey, "base");
  }

  async function handleSave() {
    if (!selectedKid) return;
    setSaving(true);
    try {
      const rows = Object.entries(effective).map(([key, variant]) => {
        const [day, activityKey] = key.split("|");
        return {
          kid_id: selectedKid.id,
          day_index: Number(day),
          activity_key: activityKey!,
          variant,
        };
      });
      const { error: deleteError } = await supabase
        .from("kid_entries")
        .delete()
        .eq("kid_id", selectedKid.id);
      if (deleteError) throw deleteError;
      if (rows.length > 0) {
        const { error } = await supabase.from("kid_entries").insert(rows);
        if (error) throw error;
      }
      setDirty(false);
      toast.success("Changes saved");
      queryClient.invalidateQueries({ queryKey: ["totals"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleKidDialogSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!kidDialog) return;
    const draft = kidDialog.draft;
    if (!draft.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    try {
      if (kidDialog.mode === "add") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const { data, error } = await supabase
          .from("kids")
          .insert({
            user_id: user.id,
            name: draft.name.trim(),
            age_category: draft.age_category,
            program: draft.program,
          })
          .select("id")
          .single();
        if (error) throw error;
        setSelectedKidId(data.id);
        toast.success("Kid added");
      } else if (selectedKid) {
        const { error } = await supabase
          .from("kids")
          .update({
            name: draft.name.trim(),
            age_category: draft.age_category,
            program: draft.program,
          })
          .eq("id", selectedKid.id);
        if (error) throw error;
        toast.success("Kid updated");
      }
      setKidDialog(null);
      queryClient.invalidateQueries({ queryKey: ["kids"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save kid");
    }
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const choiceActivity = choice ? ACTIVITY_BY_KEY[choice.activityKey] : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-deep-red px-4 py-4 text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">
              Jain Sangh of Greater Austin
            </p>
            <h1 className="font-serif text-2xl text-gold-bright">
              Paryushan / Das Lakshan Niyam Sheet
            </h1>
            <p className="text-xs text-gold/60">{programRange(program)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">
                  <Shield className="size-4" /> Admin
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" /> Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_18rem]">
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kid:
            </span>
            {kids.map((kid) => {
              const active = kid.id === selectedKid?.id;
              return (
                <button
                  key={kid.id}
                  onClick={() => setSelectedKidId(kid.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <span className="font-medium">{kid.name}</span>
                  <span className={active ? "text-gold/80" : "text-muted-foreground"}>
                    · {PROGRAMS[kid.program].label} · {kid.age_category}
                  </span>
                  <span className="rounded-full bg-accent px-2 text-xs font-semibold text-accent-foreground">
                    {totals[kid.id] ?? 0}
                  </span>
                </button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setKidDialog({ mode: "add", draft: emptyKid() })}
            >
              <Plus className="size-4" /> Add kid
            </Button>
            {selectedKid && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setKidDialog({
                    mode: "edit",
                    draft: {
                      name: selectedKid.name,
                      age_category: selectedKid.age_category,
                      program: selectedKid.program,
                    },
                  })
                }
              >
                <Pencil className="size-4" /> Edit kid
              </Button>
            )}
          </div>

          {!selectedKid ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Add a kid to start filling in the niyam sheet.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                Tracking for <span className="font-medium text-foreground">{selectedKid.name}</span>{" "}
                · {PROGRAMS[program].label} ({PROGRAMS[program].days} days) · age{" "}
                {selectedKid.age_category}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-primary" /> DO
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-accent" /> DON'T
                </span>
                <span>Rows 2.1–2.5: pick only one per day</span>
                {program === "das_lakshan" && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-muted" /> Lowest days (not counted)
                  </span>
                )}
              </div>

              {program === "das_lakshan" && (
                <div className="mt-4 rounded-xl border border-accent/60 bg-accent/15 p-3 text-sm">
                  <span className="font-semibold">Das Lakshan:</span> your grand total counts the
                  best 8 of 10 days — the 2 lowest days are dropped (shown greyed out) to keep it
                  fair with Paryushan participants.
                </div>
              )}

              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="px-2 py-3 text-left text-xs font-semibold">#</th>
                      <th className="min-w-56 px-2 py-3 text-left text-xs font-semibold">
                        Activity
                      </th>
                      <th className="px-2 py-3 text-xs font-semibold">Pts</th>
                      {days.map(({ index, date }) => {
                        const { weekday, md } = formatDay(date);
                        const isDropped = dropped.has(index);
                        return (
                          <th
                            key={index}
                            className={`px-2 py-2 text-xs font-semibold ${isDropped ? "text-primary-foreground/50" : ""}`}
                          >
                            <div>{weekday}</div>
                            <div className="font-normal">{md}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIVITIES.map((activity) => (
                      <tr key={activity.key} className="border-t border-border">
                        <td className="px-2 py-2 text-xs text-muted-foreground">{activity.key}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                activity.kind === "do"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-accent text-accent-foreground"
                              }`}
                            >
                              {activity.kind === "do" ? "DO" : "DON'T"}
                            </span>
                            <span className="leading-snug">{activity.label}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center text-xs font-semibold">
                          {activity.altPoints
                            ? `${activity.points}/${activity.altPoints}`
                            : activity.points}
                        </td>
                        {days.map(({ index }) => {
                          const key = cellKey(index, activity.key);
                          const variant = effective[key];
                          const isForced = forced.has(key);
                          const isDropped = dropped.has(index);
                          return (
                            <td
                              key={index}
                              className={`px-2 py-2 text-center ${isDropped ? "bg-muted/60" : ""}`}
                            >
                              <Checkbox
                                checked={Boolean(variant)}
                                disabled={isForced}
                                onCheckedChange={() => toggleCell(index, activity.key)}
                                aria-label={`${activity.label} on day ${index + 1}`}
                                className={isDropped ? "opacity-50" : ""}
                              />
                              {variant === "alt" && activity.choice && (
                                <div className="text-[10px] text-accent-foreground">
                                  {activity.choice.altShortLabel}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-primary text-primary-foreground">
                      <td colSpan={3} className="px-2 py-3 text-xs font-bold uppercase">
                        Daily total
                      </td>
                      {perDay.map(({ index, points }) => (
                        <td
                          key={index}
                          className={`px-2 py-3 text-center text-sm font-semibold ${
                            dropped.has(index) ? "text-primary-foreground/50 line-through" : ""
                          }`}
                        >
                          {points}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {dirty ? "Your changes are not saved yet." : "All changes saved."}
                </p>
                <Button onClick={handleSave} disabled={saving || !dirty}>
                  <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 bg-deep-red px-4 py-3 text-gold-bright">
              <Trophy className="size-4" />
              <span className="font-serif text-lg">Leaderboard</span>
            </div>
            <div className="px-4 py-2 text-xs text-muted-foreground">
              Age {selectedKid?.age_category ?? "—"}
            </div>
            <ul className="divide-y divide-border">
              {leaderboard.map((row, position) => {
                const mine = kids.some((kid) => kid.id === row.kid_id);
                return (
                  <li
                    key={row.kid_id}
                    className={`flex items-center gap-2 px-4 py-2 text-sm ${mine ? "bg-accent/15" : ""}`}
                  >
                    <span className="w-5 text-xs text-muted-foreground">{position + 1}</span>
                    <span className="flex-1 truncate">
                      <span className="font-medium">{row.name}</span>
                      {mine && (
                        <span className="ml-1 text-[10px] uppercase text-accent-foreground">
                          you
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {PROGRAMS[row.program as Program].label === "Paryushan" ? "P" : "DL"}
                    </span>
                    <span className="font-semibold">{row.points}</span>
                  </li>
                );
              })}
              {leaderboard.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted-foreground">No entries yet.</li>
              )}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              Your kids' totals
            </div>
            <ul className="divide-y divide-border">
              {kids.map((kid) => (
                <li key={kid.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    {kid.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {PROGRAMS[kid.program].label}
                    </span>
                  </span>
                  <span className="font-semibold">{totals[kid.id] ?? 0}</span>
                </li>
              ))}
            </ul>
            {selectedKid && (
              <div className="flex items-center justify-between bg-deep-red px-4 py-2 text-sm text-gold-bright">
                <span>{selectedKid.name} (live)</span>
                <span className="font-semibold">{total}</span>
              </div>
            )}
          </div>
        </aside>
      </main>

      <Dialog open={Boolean(choice)} onOpenChange={(open) => !open && setChoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{choiceActivity?.choice?.title}</DialogTitle>
            <DialogDescription>Pick what was done so points are counted correctly.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (choice) setCell(choice.day, choice.activityKey, "base");
                setChoice(null);
              }}
            >
              {choiceActivity?.choice?.baseLabel}
            </Button>
            <Button
              onClick={() => {
                if (choice) setCell(choice.day, choice.activityKey, "alt");
                setChoice(null);
              }}
            >
              {choiceActivity?.choice?.altLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(kidDialog)} onOpenChange={(open) => !open && setKidDialog(null)}>
        <DialogContent>
          <form onSubmit={handleKidDialogSubmit}>
            <DialogHeader>
              <DialogTitle>{kidDialog?.mode === "add" ? "Add a kid" : "Edit kid"}</DialogTitle>
              <DialogDescription>
                Paryushan runs 8 days; Das Lakshan runs 10 days with the best 8 counted.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {kidDialog && (
                <KidFields
                  idPrefix="kid-dialog"
                  value={kidDialog.draft}
                  onChange={(draft) => setKidDialog({ ...kidDialog, draft })}
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setKidDialog(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
