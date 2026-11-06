import { ArrowRight, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { PublishProgress } from "@/lib/publish-progress";

export function PublishProgressPanel({
  progress,
  onDismiss,
}: {
  progress: PublishProgress;
  onDismiss?: () => void;
}) {
  const active = progress.status === "uploading" || progress.status === "processing";
  const complete = progress.status === "complete";
  const Icon = active ? Loader2 : complete ? CheckCircle2 : CircleAlert;

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6" aria-live="polite">
      <div className="border-y border-border/60 py-8">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className={`h-6 w-6 ${active && progress.status === "uploading" ? "animate-spin" : ""}`} />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase text-muted-foreground">{progress.appName}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">
          {active ? "Your submission is still in progress" : complete ? "Your app was submitted" : "Your submission needs attention"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{progress.label}</p>
        {active && (
          <div className="mt-5" role="progressbar" aria-valuenow={Math.round(progress.percent)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
            </div>
            <p className="mt-2 text-right text-xs text-muted-foreground">{Math.round(progress.percent)}%</p>
          </div>
        )}
        {progress.error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{progress.error}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/developer">Developer Hub <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          {onDismiss && (
            <Button variant="outline" onClick={onDismiss}>
              {active ? "Hide status" : "Dismiss"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}