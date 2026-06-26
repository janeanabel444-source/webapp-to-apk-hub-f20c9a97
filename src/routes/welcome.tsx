import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Store,
  Gamepad2,
  Upload,
  Crown,
  ShieldCheck,
  Star,
  Download,
  Smartphone,
  QrCode,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareAppButton, getLandingUrl } from "@/components/ShareAppButton";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Nova Mind AI — Apps, Games & AI Image Generation" },
      {
        name: "description",
        content:
          "Discover apps, games, and AI-powered creativity in one platform. Install Nova Mind AI now.",
      },
      { property: "og:title", content: "Nova Mind AI" },
      {
        property: "og:description",
        content: "Discover apps, games, and AI-powered creativity in one platform.",
      },
    ],
  }),
  component: Welcome,
});

type Platform = "android" | "ios" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "desktop";
}

function useInstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return {
    canPrompt: !!evt,
    prompt: async () => {
      if (!evt) return false;
      evt.prompt();
      const choice = await evt.userChoice;
      setEvt(null);
      return choice?.outcome === "accepted";
    },
  };
}

function Welcome() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const { canPrompt, prompt } = useInstallPrompt();
  const url = getLandingUrl();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  async function handleInstall() {
    if (canPrompt) {
      const ok = await prompt();
      if (ok) return;
    }
    // Fallback: scroll to instructions
    document.getElementById("install-instructions")?.scrollIntoView({ behavior: "smooth" });
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  return (
    <div className="bg-background">
      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <div
              className="grid h-16 w-16 place-items-center rounded-3xl shadow-lg"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Nova Mind AI
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Discover apps, games, and AI-powered creativity in one platform.
            </p>
            <div className="mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-12 rounded-full px-7 text-base font-semibold"
                onClick={handleInstall}
              >
                <Download className="mr-2 h-5 w-5" /> Install App
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full px-7 text-base font-semibold"
              >
                <Link to="/auth">
                  Get Started <ArrowRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="mt-4">
              <ShareAppButton variant="ghost" label="Share Nova Mind AI" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Everything in one app</h2>
          <p className="mt-2 text-muted-foreground">
            A complete platform for discovery, creation, and publishing.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: Sparkles, t: "AI Image Generation", d: "Create stunning images from text prompts with Stability AI." },
            { i: Store, t: "App Store", d: "Browse and install handpicked apps from developers worldwide." },
            { i: Gamepad2, t: "Game Store", d: "Find new games to play with ratings, reviews, and trending lists." },
            { i: Upload, t: "Developer Upload Portal", d: "Publish your apps to thousands of users with simple uploads." },
            { i: Crown, t: "Premium Features", d: "Unlock unlimited AI images, faster access, and more." },
            { i: ShieldCheck, t: "Secure Google Login", d: "Sign in safely with Google or email and password." },
            { i: Star, t: "Reviews & Ratings", d: "Read trusted reviews from real users before you install." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border/60 bg-card p-5 transition hover:shadow-md">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-lg font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">How it works</h2>
            <p className="mt-2 text-muted-foreground">Get started in four simple steps.</p>
          </div>
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Sign in with Google",
              "Explore Apps, Games & AI Tools",
              "Generate AI Images",
              "Install Apps & Discover Content",
            ].map((step, idx) => (
              <li key={step} className="relative rounded-2xl border border-border/60 bg-card p-5">
                <span className="font-display text-3xl font-black text-primary/30">0{idx + 1}</span>
                <p className="mt-2 font-display text-lg font-bold">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">See it in action</h2>
          <p className="mt-2 text-muted-foreground">A peek inside Nova Mind AI.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Home Page", i: Store },
            { t: "AI Image Generator", i: Sparkles },
            { t: "App Store", i: Smartphone },
            { t: "Developer Dashboard", i: Upload },
          ].map(({ t, i: Icon }) => (
            <div
              key={t}
              className="group relative aspect-[9/16] overflow-hidden rounded-3xl border border-border/60 bg-card"
            >
              <div
                className="absolute inset-0 grid place-items-center"
                style={{ backgroundImage: "var(--gradient-hero)" }}
              >
                <Icon className="h-12 w-12 text-primary/60" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4">
                <p className="font-display text-sm font-bold">{t}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PREMIUM */}
      <section
        className="border-y border-border/60"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div className="text-primary-foreground">
              <Crown className="h-9 w-9" />
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Go Premium</h2>
              <p className="mt-2 text-primary-foreground/90">
                Unlock the full Nova Mind AI experience.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="mt-6 h-12 rounded-full px-7 text-base font-semibold"
              >
                <Link to="/premium">View Premium Plans</Link>
              </Button>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                "Image Downloads",
                "Higher Daily Limits",
                "Faster Access",
                "Additional Features",
              ].map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 p-3 text-primary-foreground backdrop-blur"
                >
                  <CheckCircle2 className="h-5 w-5" /> <span className="font-medium">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section id="install-instructions" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card p-8 text-center sm:p-12">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to get started?</h2>
          <p className="mt-2 text-muted-foreground">
            Install Nova Mind AI on your device in seconds.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 rounded-full px-7 text-base font-semibold"
              onClick={handleInstall}
            >
              <Download className="mr-2 h-5 w-5" /> Download App
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full px-7 text-base font-semibold"
              onClick={handleInstall}
            >
              <Smartphone className="mr-2 h-5 w-5" /> Install Now
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 text-left sm:grid-cols-2">
            {platform === "android" && (
              <div className="rounded-2xl border border-border/60 bg-background p-5">
                <h3 className="font-display text-lg font-bold">On Android</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap <strong>Install App</strong> above. If no prompt appears, open your browser
                  menu and choose <strong>"Add to Home screen"</strong>.
                </p>
              </div>
            )}
            {platform === "ios" && (
              <div className="rounded-2xl border border-border/60 bg-background p-5">
                <h3 className="font-display text-lg font-bold">On iPhone / iPad</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  In Safari, tap the <strong>Share</strong> icon, then choose{" "}
                  <strong>"Add to Home Screen"</strong>.
                </p>
              </div>
            )}
            {platform === "desktop" && (
              <>
                <div className="rounded-2xl border border-border/60 bg-background p-5">
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                    <QrCode className="h-5 w-5" /> Scan to install
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Scan this QR code with your phone to open Nova Mind AI on mobile.
                  </p>
                  <img
                    src={qrSrc}
                    alt="QR code to install Nova Mind AI"
                    className="mt-3 h-44 w-44 rounded-xl border border-border bg-white p-2"
                  />
                </div>
                <div className="rounded-2xl border border-border/60 bg-background p-5">
                  <h3 className="font-display text-lg font-bold">Mobile download steps</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Scan the QR code with your phone camera.</li>
                    <li>Open the link in Chrome (Android) or Safari (iOS).</li>
                    <li>Choose <strong>Install App</strong> or <strong>Add to Home Screen</strong>.</li>
                  </ol>
                </div>
              </>
            )}
          </div>

          <div className="mt-8">
            <ShareAppButton size="lg" className="rounded-full" label="Share Nova Mind AI" />
          </div>
        </div>
      </section>
    </div>
  );
}
