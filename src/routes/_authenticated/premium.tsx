import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Crown, Sparkles, Image as ImageIcon, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyPremiumStatus } from "@/lib/premium.functions";
import { initPremiumPayment } from "@/lib/paystack.functions";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Go Premium — Nova App Store" }] }),
  component: PremiumPage,
});

function PremiumPage() {
  const getStatus = useServerFn(getMyPremiumStatus);
  const initPay = useServerFn(initPremiumPayment);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => getStatus({ data: undefined as never }),
  });

  async function upgrade() {
    setErr(null);
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/payment-callback`;
      const { authorizationUrl } = await initPay({ data: { callbackUrl } });
      window.location.href = authorizationUrl;
    } catch (e: any) {
      setErr(e?.message ?? "Could not start checkout");
      setLoading(false);
    }
  }

  const benefits = [
    { icon: ImageIcon, label: "Unlimited AI image generation (Stability AI)" },
    { icon: Zap, label: "Priority processing & higher request limits" },
    { icon: Sparkles, label: "Early access to AI video & advanced tools" },
    { icon: Crown, label: "Premium badge on your reviews" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-pop)" }}
          >
            <Crown className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Nova Premium</h1>
            <p className="text-sm text-muted-foreground">
              Unlock AI image generation and everything coming next.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-5xl font-bold">₦5,000</span>
          <span className="text-muted-foreground">/ one-time</span>
        </div>

        <ul className="mt-6 space-y-3">
          {benefits.map((b) => (
            <li key={b.label} className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 text-primary" />
              <span className="text-sm">{b.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {status?.isPremium ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <Crown className="h-4 w-4 text-primary" />
              You're a Premium member. Enjoy!
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={upgrade}
              disabled={loading}
            >
              {loading ? "Redirecting to checkout…" : "Go Premium with Paystack"}
            </Button>
          )}
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Secure checkout powered by Paystack. Cards, bank, USSD & transfer supported.
          </p>
        </div>
      </div>
    </div>
  );
}
