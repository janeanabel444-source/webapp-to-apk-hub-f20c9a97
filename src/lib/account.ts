import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PHOTO_PREFIX = "profile-photos:";

export function accountQueryOptions(userId: string) {
  return queryOptions({
    queryKey: ["account", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id, display_name, avatar_url").eq("id", userId).single();
      if (error) throw error;
      let photoUrl = data.avatar_url;
      if (photoUrl?.startsWith(PHOTO_PREFIX)) {
        const { data: signed, error: photoError } = await supabase.storage
          .from("profile-photos").createSignedUrl(photoUrl.slice(PHOTO_PREFIX.length), 3600);
        if (photoError) throw photoError;
        photoUrl = signed.signedUrl;
      }
      return { ...data, photoUrl };
    },
  });
}