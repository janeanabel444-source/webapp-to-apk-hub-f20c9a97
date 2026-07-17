import { useState } from "react";
import { Flag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { submitReport } from "@/lib/store-extras";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const REASONS = [
  { v: "malware", l: "Malware or unsafe behavior" },
  { v: "broken", l: "App is broken / doesn't work" },
  { v: "inappropriate", l: "Inappropriate content" },
  { v: "copyright", l: "Copyright / trademark issue" },
  { v: "spam", l: "Spam or misleading" },
  { v: "other", l: "Something else" },
] as const;

export function ReportAppDialog({ appId }: { appId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<typeof REASONS[number]["v"]>("broken");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      return;
    }
    setBusy(true);
    try {
      await submitReport(user.id, appId, reason, details.trim());
      toast.success("Thanks — our team will review this app");
      setOpen(false);
      setDetails("");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't submit report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
          <Flag className="h-3.5 w-3.5" /> Report this app
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report app</DialogTitle>
          <DialogDescription>
            Help us keep Nova safe. All reports are reviewed by the trust & safety team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <label key={r.v} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={r.v}
                  checked={reason === r.v}
                  onChange={() => setReason(r.v)}
                />
                {r.l}
              </label>
            ))}
          </div>
          <Textarea
            placeholder="Additional details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
