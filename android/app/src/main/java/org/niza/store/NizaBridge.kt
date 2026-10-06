package org.niza.store

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Legacy JS interface implementing the contract in src/lib/native-bridge.ts.
 * Register with: webView.addJavascriptInterface(NizaBridge(activity, webView), "NizaAndroid")
 * Every method gets (id, argsJson) and replies via window.__nizaResolve(id, json).
 * Download progress is pushed via window.__nizaEvent(json) with REAL byte counts.
 */
class NizaBridge(private val activity: Activity, private val webView: WebView) {

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newFixedThreadPool(3)
    private val downloads = ConcurrentHashMap<String, File>()
    private val cancelled = ConcurrentHashMap.newKeySet<String>()
    private val apkDir by lazy { File(activity.cacheDir, "apks").apply { mkdirs() } }

    // ── JS plumbing ──────────────────────────────────────────────────────
    private fun js(script: String) = main.post { webView.evaluateJavascript(script, null) }
    private fun reply(id: String, data: Any?) =
        js("window.__nizaResolve&&window.__nizaResolve(${JSONObject.quote(id)},${JSONObject.quote(JSONObject().put("ok", true).put("data", data ?: JSONObject.NULL).toString())})")
    private fun fail(id: String, msg: String) =
        js("window.__nizaResolve&&window.__nizaResolve(${JSONObject.quote(id)},${JSONObject.quote(JSONObject().put("ok", false).put("error", msg).toString())})")
    private fun event(payload: JSONObject) =
        js("window.__nizaEvent&&window.__nizaEvent(${JSONObject.quote(payload.toString())})")

    private inline fun safe(id: String, block: () -> Unit) {
        try { block() } catch (t: Throwable) { fail(id, t.message ?: t.javaClass.simpleName) }
    }
    private fun args(json: String?) = try { JSONObject(json ?: "{}") } catch (_: Exception) { JSONObject() }

    // ── Contract ─────────────────────────────────────────────────────────
    @JavascriptInterface
    fun getCapabilities(id: String, argsJson: String?) = safe(id) {
        val caps = JSONArray(listOf("getCapabilities", "isPackageInstalled", "downloadApk", "cancelDownload",
            "installApk", "launchPackage", "uninstallPackage", "openSettings", "getDeviceInfo"))
        reply(id, JSONObject().put("version", "1.0.0").put("capabilities", caps))
    }

    @JavascriptInterface
    fun isPackageInstalled(id: String, argsJson: String?) = safe(id) {
        val pkg = args(argsJson).getString("packageName")
        val pm = activity.packageManager
        val out = JSONObject()
        try {
            val info = if (Build.VERSION.SDK_INT >= 33)
                pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
            else @Suppress("DEPRECATION") pm.getPackageInfo(pkg, 0)
            val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
            out.put("installed", true).put("versionName", info.versionName ?: "")
                .put("versionCode", code).put("launchable", pm.getLaunchIntentForPackage(pkg) != null)
        } catch (_: PackageManager.NameNotFoundException) {
            out.put("installed", false)
        }
        reply(id, out)
    }

    @JavascriptInterface
    fun downloadApk(id: String, argsJson: String?) = safe(id) {
        val a = args(argsJson)
        val downloadId = a.getString("downloadId")
        val url = a.getString("url")
        val name = a.optString("fileName", "$downloadId.apk").replace(Regex("[^A-Za-z0-9._-]"), "_")
        val target = File(apkDir, if (name.endsWith(".apk")) name else "$name.apk")
        reply(id, JSONObject().put("started", true))
        io.execute { runDownload(downloadId, url, target) }
    }

    private fun runDownload(downloadId: String, url: String, target: File) {
        fun ev(state: String, loaded: Long, total: Long, err: String? = null) = event(
            JSONObject().put("type", "download").put("downloadId", downloadId).put("state", state)
                .put("loaded", loaded).put("total", total).apply { if (err != null) put("error", err) })
        var conn: HttpURLConnection? = null
        try {
            var current = URL(url)
            // Follow redirects manually (HttpURLConnection won't cross http→https).
            repeat(6) {
                conn = (current.openConnection() as HttpURLConnection).apply {
                    instanceFollowRedirects = false; connectTimeout = 20_000; readTimeout = 60_000
                }
                val code = conn!!.responseCode
                if (code in 300..399) {
                    current = URL(current, conn!!.getHeaderField("Location")); conn!!.disconnect()
                } else {
                    if (code !in 200..299) throw IllegalStateException("Server returned $code")
                    return@repeat
                }
            }
            val c = conn!!
            val total = c.contentLengthLong.coerceAtLeast(0)
            ev("started", 0, total)
            var loaded = 0L; var lastEmit = 0L
            val tmp = File(target.path + ".part")
            c.inputStream.use { input -> tmp.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    if (cancelled.remove(downloadId)) { tmp.delete(); ev("cancelled", loaded, total); return }
                    val n = input.read(buf); if (n < 0) break
                    out.write(buf, 0, n); loaded += n
                    val now = System.currentTimeMillis()
                    if (now - lastEmit > 200) { lastEmit = now; ev("progress", loaded, total) }
                }
            } }
            if (total > 0 && loaded != total) throw IllegalStateException("Incomplete download")
            target.delete(); tmp.renameTo(target)
            downloads[downloadId] = target
            ev("completed", loaded, if (total > 0) total else loaded)
        } catch (t: Throwable) {
            ev("failed", 0, 0, t.message ?: "Download failed")
        } finally { conn?.disconnect() }
    }

    @JavascriptInterface
    fun cancelDownload(id: String, argsJson: String?) = safe(id) {
        cancelled.add(args(argsJson).getString("downloadId"))
        reply(id, JSONObject().put("cancelled", true))
    }

    @JavascriptInterface
    fun installApk(id: String, argsJson: String?) = safe(id) {
        val file = downloads[args(argsJson).getString("downloadId")]
            ?: return@safe fail(id, "Download not found")
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            main.post {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${activity.packageName}")))
            }
            return@safe fail(id, "install_permission_required: allow Niza to install apps, then tap Install again")
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        main.post { activity.startActivity(intent) }
        reply(id, JSONObject().put("started", true))
    }

    @JavascriptInterface
    fun launchPackage(id: String, argsJson: String?) = safe(id) {
        val pkg = args(argsJson).getString("packageName")
        val intent = activity.packageManager.getLaunchIntentForPackage(pkg)
            ?: return@safe fail(id, "App cannot be opened")
        main.post { activity.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        reply(id, JSONObject().put("launched", true))
    }

    @JavascriptInterface
    fun uninstallPackage(id: String, argsJson: String?) = safe(id) {
        val pkg = args(argsJson).getString("packageName")
        @Suppress("DEPRECATION")
        val intent = Intent(Intent.ACTION_UNINSTALL_PACKAGE, Uri.parse("package:$pkg"))
            .putExtra(Intent.EXTRA_RETURN_RESULT, true)
        pendingUninstall = id to pkg
        main.post {
            try { activity.startActivityForResult(intent, REQ_UNINSTALL) }
            catch (_: ActivityNotFoundException) { pendingUninstall = null; fail(id, "Uninstall not supported") }
        }
    }

    private var pendingUninstall: Pair<String, String>? = null

    /** Call from MainActivity.onActivityResult. */
    fun onActivityResult(requestCode: Int) {
        if (requestCode != REQ_UNINSTALL) return
        val (id, pkg) = pendingUninstall ?: return
        pendingUninstall = null
        val stillThere = try { activity.packageManager.getPackageInfo(pkg, 0); true }
            catch (_: PackageManager.NameNotFoundException) { false }
        reply(id, JSONObject().put("uninstalled", !stillThere))
    }

    /** Call from MainActivity.onResume so the web app refreshes install state. */
    fun onResume() = js("window.dispatchEvent(new Event('niza:foreground'))")

    @JavascriptInterface
    fun openSettings(id: String, argsJson: String?) = safe(id) {
        val action = when (args(argsJson).optString("target")) {
            "unknown_sources" -> Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES
            else -> Settings.ACTION_APPLICATION_DETAILS_SETTINGS
        }
        main.post { activity.startActivity(Intent(action, Uri.parse("package:${activity.packageName}"))) }
        reply(id, JSONObject().put("opened", true))
    }

    @JavascriptInterface
    fun getDeviceInfo(id: String, argsJson: String?) = safe(id) {
        reply(id, JSONObject().put("androidVersion", Build.VERSION.RELEASE).put("sdkInt", Build.VERSION.SDK_INT)
            .put("model", "${Build.MANUFACTURER} ${Build.MODEL}").put("abis", JSONArray(Build.SUPPORTED_ABIS.toList())))
    }

    companion object { const val REQ_UNINSTALL = 4711 }
}
