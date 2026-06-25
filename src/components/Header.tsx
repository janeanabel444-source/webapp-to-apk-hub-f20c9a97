import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, LogOut, LibraryBig, User as UserIcon, Crown, Code2, Images, Gift } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems: Array<{ to: any; label: string; exact?: boolean; muted?: boolean }> = [
  { to: "/", label: "Home", exact: true },
  { to: "/apps", label: "Apps" },
  { to: "/games", label: "Games" },
  { to: "/trending", label: "Trending" },
  { to: "/categories", label: "Categories" },
  { to: "/ai-tools", label: "AI Tools", muted: true },
];

export function Header() {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-pop)" }}>
            <Sparkles className="h-4 w-4" />
          </span>
          Nova
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-secondary text-foreground" : (n as any).muted ? "text-muted-foreground/70 hover:text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <Link
            to="/developer"
            className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              pathname.startsWith("/developer")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-primary/40 text-primary hover:bg-primary/10"
            }`}
          >
            <Code2 className="h-4 w-4" /> Developer Hub
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border bg-surface px-1 py-1 pr-3 transition hover:shadow-md">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {(user.email ?? "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user.email?.split("@")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to="/library"><LibraryBig className="mr-2 h-4 w-4" /> My library</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/developer"><Code2 className="mr-2 h-4 w-4" /> Developer Hub</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ai-tools"><Images className="mr-2 h-4 w-4" /> AI Tools</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/redeem"><Gift className="mr-2 h-4 w-4" /> Redeem promo code</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/premium"><Crown className="mr-2 h-4 w-4" /> Go Premium</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/library"><UserIcon className="mr-2 h-4 w-4" /> Account</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="rounded-full px-5">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border/50 px-4 py-2 md:hidden">
        {navItems.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${active ? "bg-secondary" : "text-muted-foreground"}`}>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
