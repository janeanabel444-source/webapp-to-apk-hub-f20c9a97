<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Account settings use owner-scoped profile updates and private photo storage with signed display URLs; this keeps uploaded photos private under workspace policy.
- Account is a protected route separate from Library, and both share the cached profile query so navigation reflects saved changes.
- APK submissions use camelCase TUS metadata and verify the private `app-files` object before inspection; publish progress is stored in a browser-scoped shared store so route changes do not hide an active submission.
