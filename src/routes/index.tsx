import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Harbor" },
      {
        name: "description",
        content:
          "Sign in to your Harbor account with email and password or continue with Google. Password reset included.",
      },
      { property: "og:title", content: "Sign in — Harbor" },
      {
        property: "og:description",
        content: "Sign in to your Harbor account with email, password, or Google.",
      },
    ],
  }),
  component: SignInPage,
});

type Mode = "signin" | "signup" | "forgot";

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo(email);
        toast.success("Password reset link sent");
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
      return;
    }
    if (result.redirected) return;
  }

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
            H
          </span>
          <h1 className="mt-5 font-serif text-3xl tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll email you a secure link to choose a new password."
              : "Harbor keeps your work in one calm place."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {sentTo ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-foreground">
                Check <span className="font-medium">{sentTo}</span> for a link from us.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSentTo(null);
                  setMode("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        onClick={() => setMode("forgot")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
              </Button>

              {mode !== "forgot" && (
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
            </form>
          )}
        </div>

        {!sentTo && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/reset-password" className="underline-offset-4 hover:underline">
            Have a reset link?
          </Link>
        </p>
      </div>
    </main>
  );
}
