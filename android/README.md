# Niza Android wrapper

Native side of the bridge in `src/lib/native-bridge.ts` (legacy `NizaAndroid` interface).

Drop these files into an Android Studio project (package `org.niza.store`, minSdk 24, targetSdk 34),
with dependencies `androidx.appcompat:appcompat` and `androidx.core:core-ktx`.

- `MainActivity.kt` — WebView loading the store, registers the bridge, forwards resume/uninstall results.
- `NizaBridge.kt` — capabilities, real-byte APK download with progress events, install via FileProvider,
  installed/version/launchable checks, open, uninstall, settings, device info.
- `AndroidManifest.xml` + `res/xml/file_paths.xml` — permissions, package visibility, FileProvider.

On first install Android asks the user to allow "Install unknown apps" for Niza; the bridge opens that
screen automatically and the user taps Install again.
