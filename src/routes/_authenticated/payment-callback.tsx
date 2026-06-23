import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyPremiumPayment } from "@/lib/paystack.functions";
import { z } from "zod";

const searchSchema = z.object({
  reference: z.string().optional(),
  trxref: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/payment-callback")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Verifying payment — Nova" }] }),
  component: Callback,
});

function Callback() {
  const { reference, trxref } = useSearch({ from: "/_authenticated/payment-callback" });
  const ref = reference ?? trxref;
  const verify = useServerFn(verifyPremiumPayment);
  const [state, setState] = useState<"loading" | "success" | "failed">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!ref) {
      setState("failed");
      setMsg("Missing payment reference.");
      return;
    }
    verify({ data: { reference: ref } })
      .then((r) => {
        if (r.success) setState("success");
        else {
          setState("failed");
          setMsg(`Payment status: ${r.status}`);
        }
      })
      .catch((e) => {
        setState("failed");
        setMsg(e?.message ?? "Verification error");
      });
  }, [ref, verify]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {state === "loading" && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">Verifying your payment…</h1>
          <p className="mt-2 text-sm text-muted-foreground">Hold tight, this only takes a second.</p>
        </>
      )}
      {state === "success" && (
        <>
          <CheckCircle2 className="h-14 w-14 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">Welcome to Premium!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account has been upgraded.</p>
          <Link
            to="/ai-image"
            className="mt-6 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
          >
            Try AI Image Generation
          </Link>
        </>
      )}
      {state === "failed" && (
        <>
          <XCircle className="h-14 w-14 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-bold">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
          <Link
            to="/premium"
            className="mt-6 inline-block rounded-full border border-border bg-card px-6 py-2 text-sm font-medium"
          >
            Try again
          </Link>
        </>
      )}
    </div>
  );
}
