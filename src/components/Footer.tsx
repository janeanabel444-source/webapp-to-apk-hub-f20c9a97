import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, LinkIcon } from "lucide-react";
import { CONTACT_EMAIL, CONTACT_LINKTREE, CONTACT_WHATSAPP } from "@/routes/contact";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-muted-foreground">
          © {new Date().getFullYear()} Niza App Store ·{" "}
          <Link to="/contact" className="font-medium text-foreground hover:underline">
            Contact &amp; Support
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={CONTACT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
          <a
            href={CONTACT_LINKTREE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Linktree
          </a>
        </div>
      </div>
    </footer>
  );
}
