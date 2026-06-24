import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, Gamepad2, Briefcase, Music, MessageSquare, Camera, Book, Wrench } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — Nova App Store" }] }),
  component: CategoriesPage,
});

const groups = [
  {
    title: "Apps",
    to: "/apps" as const,
    icon: LayoutGrid,
    items: ["Productivity", "Social", "Photography", "Music", "Education", "Utilities"],
    iconMap: { Productivity: Briefcase, Social: MessageSquare, Photography: Camera, Music, Education: Book, Utilities: Wrench },
  },
  {
    title: "Games",
    to: "/games" as const,
    icon: Gamepad2,
    items: ["Action", "Puzzle", "Racing", "Adventure", "Arcade", "Strategy"],
  },
];

function CategoriesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Categories</h1>
      {groups.map((g) => (
        <section key={g.title}>
          <div className="mb-3 flex items-center gap-2">
            <g.icon className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">{g.title}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {g.items.map((c) => (
              <Link
                key={c}
                to={g.to}
                className="rounded-2xl border border-border/60 bg-card p-4 text-sm font-medium transition hover:shadow-md"
              >
                {c}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
