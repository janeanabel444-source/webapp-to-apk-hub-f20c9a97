import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { isFavorite, toggleFavorite } from "@/lib/store-extras";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FavoriteButton({ appId, className }: { appId: string; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    isFavorite(user.id, appId).then(setOn).catch(() => {});
  }, [user, appId]);

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      return;
    }
    setBusy(true);
    const next = !on;
    setOn(next);
    try {
      await toggleFavorite(user.id, appId, next);
      toast.success(next ? "Added to favorites" : "Removed from favorites");
    } catch {
      setOn(!next);
      toast.error("Couldn't update favorite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/70 backdrop-blur transition hover:scale-105",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4 transition", on ? "fill-red-500 stroke-red-500" : "stroke-muted-foreground")} />
    </button>
  );
}
