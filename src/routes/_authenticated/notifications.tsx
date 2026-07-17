import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { fetchNotifications, markNotificationsRead } from "@/lib/store-extras";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Nova" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (user) markNotificationsRead(user.id).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  }, [user, qc]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Bell className="h-5 w-5" /> Notifications
      </h1>
      <ul className="mt-6 space-y-2">
        {(data ?? []).map((n) => (
          <li key={n.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{n.title}</p>
              <time className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</time>
            </div>
            {n.body && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{n.body}</p>}
            {n.app_id && (
              <Link to="/library" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                Open library →
              </Link>
            )}
          </li>
        ))}
        {(!data || data.length === 0) && (
          <li className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
            You're all caught up.
          </li>
        )}
      </ul>
    </div>
  );
}
