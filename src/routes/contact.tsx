import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, LinkIcon, LifeBuoy } from "lucide-react";

export const CONTACT_EMAIL = "paschalsoromtochukwu@gmail.com";
// Update this link to your own Linktree URL.
export const CONTACT_LINKTREE = "https://linktr.ee/paschalsoromtochukwu";
// Optional direct WhatsApp link (wa.me/<number>) – falls back to the Linktree.
export const CONTACT_WHATSAPP = CONTACT_LINKTREE;

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Support — Niza App Store" },
      { name: "description", content: "Get in touch with the Niza App Store team via WhatsApp, email or Linktree." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const items = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      desc: "Chat with us on WhatsApp via our Linktree.",
      href: CONTACT_WHATSAPP,
      cta: "Open WhatsApp",
    },
    {
      icon: Mail,
      label: "Email",
      desc: "Reach the team directly by email.",
      href: `mailto:${CONTACT_EMAIL}`,
      cta: CONTACT_EMAIL,
    },
    {
      icon: LinkIcon,
      label: "Linktree",
      desc: "All our official links in one place.",
      href: CONTACT_LINKTREE,
      cta: "Open Linktree",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
          <LifeBuoy className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">Contact &amp; Support</h1>
        <p className="mt-2 text-muted-foreground">
          We're happy to help — pick whichever channel works best for you.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map(({ icon: Icon, label, desc, href, cta }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-3xl border border-border/60 bg-card p-6 transition hover:border-primary/50 hover:shadow-md"
          >
            <Icon className="mb-3 h-6 w-6 text-primary" />
            <div className="font-semibold">{label}</div>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</p>
            <span className="mt-4 text-sm font-medium text-primary group-hover:underline">{cta} →</span>
          </a>
        ))}
      </div>
    </div>
  );
}
