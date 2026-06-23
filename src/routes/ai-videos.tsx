import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchApps } from "@/lib/store";
import { AppCard, AppCardSkeleton } from "@/components/AppCard";

export const Route = createFileRoute("/ai-videos")({
  head: () => ({
    meta: [
      { title: "AI Videos — Nova App Store" },
      { name: "description", content: "Discover AI-generated video apps." },
    ],
  }),
  component: AiVideosPage,
});

function AiVideosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["apps", "ai_video"], queryFn: () => fetchApps("ai_video") });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">AI Videos</h1>
      <p className="mt-1 text-muted-foreground">Create and watch AI-generated video experiences.</p>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <AppCardSkeleton key={i} />)
          : (data ?? []).map((app) => <AppCard key={app.id} app={app} />)}
      </div>
    </div>
  );
}
