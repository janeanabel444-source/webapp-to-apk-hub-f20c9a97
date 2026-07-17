import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { unreadNotificationCount } from "@/lib/store-extras";

export function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => unreadNotificationCount(user.id).then((n) => alive && setCount(n)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  if (!user) return null;

  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className="relative grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-surface hover:shadow-md"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
