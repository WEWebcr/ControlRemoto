package com.controlremoto.client

import android.app.Activity
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.Window
import android.view.WindowManager

class AdminConsoleActivity : Activity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Hide title bar
        requestWindowFeature(Window.FEATURE_NO_TITLE)

        webView = WebView(this)
        setContentView(webView)

        // Get the target admin console URL
        val url = intent.getStringExtra("URL") ?: "https://remoto-control-jm.onrender.com/admin"

        // Configure WebView settings
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_NO_CACHE // Force loading from network

        // Enable pinch-to-zoom (also implemented in React CSS/JS layout)
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        // Ensure webView can receive focus and input
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.clearCache(true) // Clear cache on startup to prevent stale pages

        // Add JavaScript-Java Bridge to trigger soft keyboard programmatically
        webView.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun showKeyboard() {
                runOnUiThread {
                    webView.requestFocus()
                    webView.requestFocusFromTouch()
                    val imm = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                    // Try to show soft input implicitly, if that fails, force toggle it
                    val success = imm.showSoftInput(webView, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
                    if (!success) {
                        imm.toggleSoftInput(android.view.inputmethod.InputMethodManager.SHOW_FORCED, 0)
                    }
                }
            }

            @android.webkit.JavascriptInterface
            fun hideKeyboard() {
                runOnUiThread {
                    val imm = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                    imm.hideSoftInputFromWindow(webView.windowToken, 0)
                }
            }
        }, "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return false // Handle navigation inside WebView
            }
        }

        // Grant WebRTC and hardware media permissions dynamically
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }

        webView.loadUrl(url)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
