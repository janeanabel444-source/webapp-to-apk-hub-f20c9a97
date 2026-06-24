import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Layout route for protected pages.
 * Redirects unauthenticated users to /auth with a return URL.
 */
export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // Don't redirect while loading

    if (!user) {
      // Get current location to redirect back after login
      const returnUrl = window.location.pathname + window.location.search;
      navigate({
        to: "/auth",
        search: { redirect: returnUrl },
        replace: true,
      });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user exists, render the protected page
  if (user) {
    return <Outlet />;
  }

  // User is not authenticated and not loading - redirect will happen in the effect
  return null;
}
