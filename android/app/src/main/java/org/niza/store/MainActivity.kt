package org.niza.store

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: NizaBridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        webView.settings.apply { javaScriptEnabled = true; domStorageEnabled = true }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        bridge = NizaBridge(this, webView)
        webView.addJavascriptInterface(bridge, "NizaAndroid")
        webView.loadUrl(intent?.dataString ?: STORE_URL)
    }

    override fun onResume() { super.onResume(); if (::bridge.isInitialized) bridge.onResume() }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        bridge.onActivityResult(requestCode)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }

    companion object { const val STORE_URL = "https://webapp-to-apk-hub.lovable.app" }
}
