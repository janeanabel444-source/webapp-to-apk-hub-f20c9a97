import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SHARE_TEXT =
  "Try Nova Mind AI — discover apps, games, and AI image generation in one place. Download now.";

export function getLandingUrl() {
  if (typeof window === "undefined") return "https://webapp-to-apk-hub.lovable.app/welcome";
  return `${window.location.origin}/welcome`;
}

interface Props {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function ShareAppButton({ variant = "outline", size = "sm", className, label = "Share" }: Props) {
  const [copied, setCopied] = useState(false);
  const url = getLandingUrl();

  async function onShare() {
    const shareData = { title: "Nova Mind AI", text: SHARE_TEXT, url };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not share. Copy this link: " + url);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={onShare}>
      {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Share2 className="mr-1.5 h-4 w-4" />}
      {label}
    </Button>
  );
}
