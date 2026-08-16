import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — JSGA Niyam Tracker" },
      {
        name: "description",
        content:
          "Log in to the JSGA Niyam Tracker to fill in your kids' daily Paryushan or Das Lakshan niyam sheet.",
      },
      { property: "og:title", content: "Log in — JSGA Niyam Tracker" },
      { property: "og:description", content: "Log in to the JSGA Niyam Tracker." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo(email);
        toast.success("Password reset link sent");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed. Please try again.");
    }
  }

  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-12"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="text-3xl text-gold">
            ॐ
          </Link>
          <h1 className="mt-4 font-serif text-3xl text-gold-bright">
            {forgot ? "Reset password" : "Log in"}
          </h1>
          <p className="mt-2 text-sm text-gold/70">
            {forgot
              ? "We'll email you a secure link to choose a new password."
              : "JSGA Paryushan / Das Lakshan Niyam Sheet"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          {sentTo ? (
            <div className="space-y-4 text-center">
              <p className="text-sm">
                Check <span className="font-medium">{sentTo}</span> for a link from us.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSentTo(null);
                  setForgot(false);
                }}
              >
                Back to log in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {!forgot && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      onClick={() => setForgot(true)}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : forgot ? "Send reset link" : "Log in"}
              </Button>

              {!forgot && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      or
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogle}
                    disabled={loading}
                  >
                    Continue with Google
                  </Button>
                </>
              )}

              {forgot && (
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:underline"
                  onClick={() => setForgot(false)}
                >
                  Back to log in
                </button>
              )}
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gold/70">
          New here?{" "}
          <Link to="/signup" className="font-medium text-gold-bright hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
