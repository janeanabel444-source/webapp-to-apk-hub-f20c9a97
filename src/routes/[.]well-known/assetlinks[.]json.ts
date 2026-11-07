import { createFileRoute } from "@tanstack/react-router";

const statements = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.niza.marketplace",
      sha256_cert_fingerprints: [
        "4C:A0:E5:D2:10:F0:F1:09:26:80:15:3F:A8:25:60:4B:D5:F5:62:57:D9:56:C6:92:DE:E3:12:50:A2:5E:6C:B0",
      ],
    },
  },
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(statements), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});