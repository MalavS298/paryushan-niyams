import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Harbor" },
      { name: "description", content: "Your Harbor account overview and profile details." },
      { property: "og:title", content: "Your dashboard — Harbor" },
      { property: "og:description", content: "Your Harbor account overview." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return { email: user.email, displayName: profile?.display_name ?? null };
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Welcome{data?.displayName ? `, ${data.displayName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in{data?.email ? ` as ${data.email}` : ""}.
        </p>
        <Button variant="outline" className="mt-8" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
