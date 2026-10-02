import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBoostPrompt, setBoostPrompt } from "@/lib/boost.functions";

/** "Boost Your App" card shown on a developer's live app, with snooze/dismiss. */
export function BoostPrompt({ appId, live }: { appId: string; live: boolean }) {
  const getFn = useServerFn(getBoostPrompt);
  const setFn = useServerFn(setBoostPrompt);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["boost-prompt", appId],
    queryFn: () => getFn({ data: { appId } }),
    enabled: live,
  });
  if (!live || !data?.show) return null;
  const act = async (action: "snooze" | "dismiss") => {
    await setFn({ data: { appId, action, days: 3 } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["boost-prompt", appId] });
  };
  return (
    <div className="mt-4 rounded-3xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Rocket className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Boost your app</p>
          <p className="text-sm text-muted-foreground">Reach more people with a sponsored campaign across Niza.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link to="/developer/$appId/boost" params={{ appId }}>Boost now</Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => act("snooze")}>Remind me later</Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => act("dismiss")}>No thanks</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
