import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Crown, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemPromoCode } from "@/lib/promo.functions";

export const Route = createFileRoute("/_authenticated/redeem")({
  head: () => ({ meta: [{ title: "Redeem Promo Code — NovaMind AI" }] }),
  component: RedeemPage,
});

function RedeemPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const redeem = useServerFn(redeemPromoCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await redeem({ data: { code: trimmed } });
      if (res.granted === "premium") {
        setSuccess("Premium activated! You now have access to all premium features.");
      } else {
        setSuccess("Premium trial activated! Enjoy your trial access.");
      }
      setCode("");
      qc.invalidateQueries({ queryKey: ["ai-quota"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      setError(err?.message ?? "Couldn't redeem this code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    // Go back to the previous page if possible, otherwise to AI Tools — never bounce to Home unexpectedly.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/ai-tools" });
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <button
        onClick={handleCancel}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <div className="mt-4 rounded-3xl border border-border/60 bg-card p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Gift className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">Redeem Promo Code</h1>
            <p className="text-sm text-muted-foreground">Enter a code to unlock Premium features.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="promo">Promo code</Label>
            <Input
              id="promo"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={64}
              autoCapitalize="characters"
              autoFocus
              disabled={busy}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              {success}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button type="submit" className="h-11 flex-1 rounded-full font-semibold" disabled={busy || !code.trim()}>
              {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redeeming…</>) : "Redeem code"}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={handleCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-2">
            <Crown className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">No code? Go Premium.</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Unlimited AI generations and more.</p>
              <Link to="/premium" className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">
                See Premium plans →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
