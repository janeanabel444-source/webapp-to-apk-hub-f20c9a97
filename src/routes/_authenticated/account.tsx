import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Camera, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { accountQueryOptions, PHOTO_PREFIX } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/account")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Account settings — Niza App Store" },
    { name: "description", content: "Manage your Niza profile, photo, and password." },
    { property: "og:title", content: "Account settings — Niza App Store" },
    { property: "og:description", content: "Manage your Niza profile, photo, and password." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQueryOptions(context.user.id)),
  component: AccountPage,
});

function AccountPage() {
  const { user: routeUser } = Route.useRouteContext();
  const { user } = useAuth();
  const { data: profile } = useSuspenseQuery(accountQueryOptions(routeUser.id));
  const qc = useQueryClient();
  const [name, setName] = useState(profile.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const hasEmailPassword = (user ?? routeUser).app_metadata?.providers?.includes("email") ?? false;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setProfileStatus("Enter a display name."); return; }
    setSaving(true);
    setProfileStatus("");
    try {
      const { error } = await supabase.from("profiles").update({ display_name: name.trim() })
        .eq("id", routeUser.id).select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["account", routeUser.id] });
      setProfileStatus("Profile saved.");
    } catch (error) { setProfileStatus(error instanceof Error ? error.message : "Could not save profile."); }
    finally { setSaving(false); }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setProfileStatus("Choose a JPG, PNG, or WebP photo under 5 MB."); return;
    }
    setUploading(true);
    setProfileStatus("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${routeUser.id}/${crypto.randomUUID()}.${extension}`;
    let stored = false;
    try {
      const { error: uploadError } = await supabase.storage.from("profile-photos")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      stored = true;
      const { error } = await supabase.from("profiles").update({ avatar_url: PHOTO_PREFIX + path })
        .eq("id", routeUser.id).select("id").single();
      if (error) throw error;
      if (profile.avatar_url?.startsWith(PHOTO_PREFIX)) {
        await supabase.storage.from("profile-photos").remove([profile.avatar_url.slice(PHOTO_PREFIX.length)]);
      }
      await qc.invalidateQueries({ queryKey: ["account", routeUser.id] });
      setProfileStatus("Photo updated.");
    } catch (error) {
      if (stored) await supabase.storage.from("profile-photos").remove([path]);
      setProfileStatus(error instanceof Error ? error.message : "Could not upload photo.");
    } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmation) { setPasswordStatus("Passwords do not match."); return; }
    setPasswordBusy(true);
    setPasswordStatus("");
    try {
      const { error } = await supabase.auth.updateUser({ password,
        ...(hasEmailPassword ? { current_password: currentPassword } : {}),
      });
      if (error) throw error;
      setCurrentPassword(""); setPassword(""); setConfirmation("");
      setPasswordStatus("Password saved.");
    } catch (error) { setPasswordStatus(error instanceof Error ? error.message : "Could not save password."); }
    finally { setPasswordBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Account settings</h1>
      <section className="mt-8 border-b border-border pb-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><UserRound className="h-5 w-5 text-primary" />Profile</h2>
        <div className="mt-5 flex items-center gap-5">
          <Avatar className="h-20 w-20"><AvatarImage src={profile.photoUrl ?? undefined} alt="Your profile photo" className="object-cover" /><AvatarFallback className="text-2xl">{(name || routeUser.email || "U")[0]?.toUpperCase()}</AvatarFallback></Avatar>
          <Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}Change photo
          </Button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Profile photo" onChange={(e) => void uploadPhoto(e.target.files?.[0])} />
        </div>
        <form className="mt-6 max-w-md space-y-4" onSubmit={saveProfile}>
          <div className="space-y-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="nickname" /></div>
          <div className="space-y-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" value={routeUser.email ?? ""} readOnly type="email" className="text-muted-foreground" /></div>
          <Button disabled={saving || uploading} type="submit"><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save profile"}</Button>
        </form>
        {profileStatus && <p role="status" className="mt-3 text-sm">{profileStatus}</p>}
      </section>
      <section className="py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5 text-primary" />{hasEmailPassword ? "Update password" : "Set a password"}</h2>
        <form onSubmit={savePassword} className="mt-5 max-w-md space-y-4">
          {hasEmailPassword && <div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></div>}
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" /></div>
          <Button type="submit" disabled={passwordBusy}><KeyRound className="mr-2 h-4 w-4" />{passwordBusy ? "Saving…" : "Save password"}</Button>
        </form>
        {passwordStatus && <p role="status" className="mt-3 text-sm">{passwordStatus}</p>}
      </section>
    </div>
  );
}