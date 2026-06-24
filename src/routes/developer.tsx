import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/developer")({
  component: DeveloperLayout,
});

function DeveloperLayout() {
  return <Outlet />;
}
