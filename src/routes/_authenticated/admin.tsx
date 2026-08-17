import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PROGRAMS, type Program } from "@/lib/niyam";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — JSGA Niyam Tracker" },
      { name: "description", content: "Admin overview of every kid and their niyam points." },
      { property: "og:title", content: "Admin — JSGA Niyam Tracker" },
      { property: "og:description", content: "Admin overview of every kid and their points." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data, isError } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_kids_overview");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-deep-red px-4 py-4 text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">
              Jain Sangh of Greater Austin
            </p>
            <h1 className="font-serif text-2xl text-gold-bright">
              Admin — Paryushan / Das Lakshan Niyam Sheet
            </h1>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-gold/60 bg-transparent text-gold hover:bg-gold/10 hover:text-gold-bright"
          >
            <Link to="/dashboard">
              <ArrowLeft className="size-4" /> Tracker
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isError ? (
          <p className="text-sm text-muted-foreground">
            This account does not have admin access.
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-3 py-3 text-left text-xs font-semibold">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Kid</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Parent</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Program</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Age</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((row, index) => (
                    <tr key={row.kid_id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.parent_name ?? row.parent_email ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            row.program === "paryushan"
                              ? "bg-primary text-primary-foreground"
                              : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {PROGRAMS[row.program as Program].label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.age_category}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.points}</td>
                    </tr>
                  ))}
                  {(data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No kids registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Das Lakshan totals count the best 8 of 10 days. Paryushan runs the full 8 days.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
