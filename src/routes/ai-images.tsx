import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Gallery } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ai-images")({
  head: () => ({ meta: [{ title: "AI Images Gallery — Nova" }] }),
  component: AIImagesPage,
});

function AIImagesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-purple-500/10 p-3">
          <ImagePlus className="h-6 w-6 text-purple-600" />
        </div>
        <h1 className="font-display text-3xl font-bold">AI Images</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Generate and browse AI-created images
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Generate Card */}
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-blue-500/10 p-3">
            <ImagePlus className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="mb-2 font-display text-xl font-bold">Generate Images</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Create stunning AI images from text descriptions
          </p>
          <Button asChild className="w-full rounded-full">
            <Link to="/ai-image">Start generating</Link>
          </Button>
        </div>

        {/* Gallery Card */}
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-purple-500/10 p-3">
            <Gallery className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="mb-2 font-display text-xl font-bold">Gallery</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Browse images you've created and saved
          </p>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link to="/ai-gallery">View gallery</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
