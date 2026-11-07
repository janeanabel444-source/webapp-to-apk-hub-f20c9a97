import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORE_DOWNLOAD = "/download/c8261fad-30f4-40a0-baa5-fa22ab76e08a";

export const Route = createFileRoute("/docs")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Niza App Store Guide — Niza App Store" },
      { name: "description", content: "Learn how to browse Niza App Store on the web or use the Android companion app to install apps and games." },
      { property: "og:title", content: "Niza App Store Guide" },
      { property: "og:description", content: "A quick guide to browsing and installing Android apps with Niza App Store." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold text-primary">Niza App Store</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Browse, discover, and install Android apps</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Niza App Store connects Android users with independent apps and games. Browse the catalog on the web, or use the Android companion app to download and install APKs directly.
        </p>
        <Button asChild className="mt-5 rounded-full">
          <a href={STORE_DOWNLOAD}><ArrowDownToLine className="mr-2 h-4 w-4" />Download Niza Store</a>
        </Button>
      </header>

      <section className="border-b border-border py-8">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Smartphone className="h-5 w-5" />Install the companion app</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><span className="font-semibold text-foreground">1.</span><span>Download the Niza Store APK using the button above on your Android device.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-foreground">2.</span><span>Open the downloaded APK. If Android asks, allow Niza Store or your browser to install apps from this source.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-foreground">3.</span><span>Confirm the Android installation prompt. Then return to a Niza listing and choose Install.</span></li>
        </ol>
      </section>

      <section className="border-b border-border py-8">
        <h2 className="font-display text-xl font-semibold">Using Niza App Store</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Review app details, version information, and requested permissions before installing.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>App pages and permanent download links continue to point to the latest available release.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Developers can submit apps and manage releases from the Developer Hub.</span></li>
        </ul>
      </section>

      <p className="pt-6 text-xs text-muted-foreground">Android may request permission to install apps from the source you used to open the APK. Only proceed when you trust the download source.</p>
    </article>
  );
}