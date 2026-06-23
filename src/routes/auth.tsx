import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { redeemPromoCode } from "@/lib/promo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Gift } from "lucide-react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Nova App Store" }] }),
  component: AuthPage,
});

const PENDING_PROMO_KEY = "nova_pending_promo";

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const redeem = useServerFn(redeemPromoCode);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const pending = typeof window !== "undefined" ? window.localStorage.getItem(PENDING_PROMO_KEY) : null;
    if (pending) {
      window.localStorage.removeItem(PENDING_PROMO_KEY);
      redeem({ data: { code: pending } })
        .then((r) => {
          if (r.granted === "premium") toast.success("Promo redeemed — Premium activated!");
          else toast.success("Promo redeemed — Premium trial activated!");
        })
        .catch((e) => toast.error(e?.message ?? "Promo code couldn't be applied"))
        .finally(() => navigate({ to: redirect ?? "/", replace: true }));
    } else {
      navigate({ to: redirect ?? "/", replace: true });
    }
  }, [user, navigate, redirect, redeem]);

  function stashPromo() {
    const trimmed = promo.trim();
    if (trimmed && typeof window !== "undefined") {
      window.localStorage.setItem(PENDING_PROMO_KEY, trimmed);
    } else if (typeof window !== "undefined") {
      window.localStorage.removeItem(PENDING_PROMO_KEY);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    stashPromo();
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Couldn't sign in with Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    // session set in iframe — effect will pick it up
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      stashPromo();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
      <Link to="/" className="mb-6 flex items-center gap-2 font-display text-xl font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <Sparkles className="h-4 w-4" />
        </span>
        Nova
      </Link>

      <div className="w-full rounded-3xl border border-border/60 bg-card p-7 shadow-sm">
        <h1 className="font-display text-2xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to install apps and generate AI images." : "Join Nova to install apps and generate AI images."}
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-5 h-11 w-full rounded-full font-medium"
          onClick={handleGoogle}
          disabled={busy}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.5 2.3 2 6.8 2 12.1S6.5 22 12 22c6.9 0 9.7-4.8 9.7-7.7 0-.5-.1-1-.1-1.4H12z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo" className="flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-primary" />
              Promo code <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="e.g. JASPER AI"
              maxLength={64}
              autoCapitalize="characters"
            />
            <p className="text-xs text-muted-foreground">Enter a valid code to unlock Premium on sign-in.</p>
          </div>
          <Button type="submit" className="h-11 w-full rounded-full font-semibold" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to Nova?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-primary hover:underline">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
