import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JSGA Niyam Tracker — Paryushan & Das Lakshan Sheet" },
      {
        name: "description",
        content:
          "Digital Paryushan and Das Lakshan Niyam Sheet for Jain Sangh of Greater Austin. Track daily niyams for each kid and see the leaderboard.",
      },
      { property: "og:title", content: "JSGA Niyam Tracker" },
      {
        property: "og:description",
        content: "Digital Paryushan / Das Lakshan Niyam Sheet for Jain Sangh of Greater Austin.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-6 py-16"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-4xl rounded-3xl border border-gold/40 px-6 py-20 text-center">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-gold/70 text-4xl text-gold">
          ॐ
        </span>

        <p className="mt-8 text-xs uppercase tracking-[0.35em] text-gold/70">
          Jain Sangh of Greater Austin
        </p>

        <h1 className="mt-5 font-serif text-5xl leading-tight text-gold-bright sm:text-6xl">
          JSGA
          <br />
          Paryushan Niyam Sheet
        </h1>

        <div className="mx-auto mt-10 h-px w-32 bg-gold/40" />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-deep-red shadow-lg transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--gradient-gold)" }}
          >
            <UserPlus className="size-4" /> Sign Up
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-gold/70 px-6 py-3 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            <LogIn className="size-4" /> Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
