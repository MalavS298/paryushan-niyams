import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KidFields, emptyKid, type KidDraft } from "@/components/kid-fields";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — JSGA Niyam Tracker" },
      {
        name: "description",
        content:
          "Create a JSGA Niyam Tracker account, add each kid with their age category and program, and start tracking daily niyams.",
      },
      { property: "og:title", content: "Sign up — JSGA Niyam Tracker" },
      { property: "og:description", content: "Create your JSGA Niyam Tracker account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kids, setKids] = useState<KidDraft[]>([emptyKid()]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (kids.some((kid) => !kid.name.trim())) {
      toast.error("Please give every kid a name");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: parentName } },
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (!data.session || !userId) {
        toast.error("Account created. Please log in to continue.");
        navigate({ to: "/login" });
        return;
      }
      const { error: kidsError } = await supabase.from("kids").insert(
        kids.map((kid) => ({
          user_id: userId,
          name: kid.name.trim(),
          age_category: kid.age_category,
          program: kid.program,
        })),
      );
      if (kidsError) throw kidsError;
      toast.success("Account created");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-12"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link to="/" className="text-3xl text-gold">
            ॐ
          </Link>
          <h1 className="mt-4 font-serif text-3xl text-gold-bright">Create account</h1>
          <p className="mt-2 text-sm text-gold/70">
            One sheet per kid — Paryushan (8 days) or Das Lakshan (10 days)
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-lg"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentName">Parent name</Label>
              <Input
                id="parentName"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Malav S."
                autoComplete="name"
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-5">
            <h2 className="font-serif text-xl">Kids</h2>
            {kids.map((kid, index) => (
              <div key={index} className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Kid {index + 1}
                  </span>
                  {kids.length > 1 && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setKids(kids.filter((_, i) => i !== index))}
                      aria-label={`Remove kid ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <KidFields
                  idPrefix={`kid-${index}`}
                  value={kid}
                  onChange={(next) => setKids(kids.map((k, i) => (i === index ? next : k)))}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setKids([...kids, emptyKid()])}
            >
              <Plus className="size-4" /> Add another kid
            </Button>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gold/70">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-gold-bright hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
