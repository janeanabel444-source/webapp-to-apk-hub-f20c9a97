import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchApps from "./tools/search-apps";
import getApp from "./tools/get-app";
import listMyLibrary from "./tools/list-my-library";
import listMyDeveloperApps from "./tools/list-my-apps";
import whoami from "./tools/whoami";

// Direct supabase.co issuer — the runtime SUPABASE_URL may be a .lovable.cloud
// proxy on publish, which mcp-js rejects (RFC 8414 issuer mismatch).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nova-app-store-mcp",
  title: "Nova App Store",
  version: "0.1.0",
  instructions:
    "Tools for Nova App Store — an Android APK marketplace. Use `search_apps` to browse the public catalog, `get_app` for a listing's full details, `list_my_library` for what the signed-in user has installed, `list_my_developer_apps` for apps they publish, and `whoami` for the signed-in profile.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchApps, getApp, listMyLibrary, listMyDeveloperApps, whoami],
});
