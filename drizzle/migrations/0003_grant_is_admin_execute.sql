-- RLS policies on collections (and other admin-gated policies) call private.is_admin,
-- but no Data API role had EXECUTE on it, so even a public read of collections
-- failed with "permission denied for function is_admin". Grant EXECUTE to the
-- roles that evaluate those policies. The function only returns a boolean.
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated;