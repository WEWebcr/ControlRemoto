package com.controlremoto.client

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.DisplayMetrics
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class RemoteControlAccessibilityService : AccessibilityService() {

    companion object {
        var instance: RemoteControlAccessibilityService? = null
    }

    private var screenWidth = 0
    private var screenHeight = 0
    private var lastAutoClickTime: Long = 0

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d("RemoteControlAcc", "Accessibility Service conectado")
        
        actualizarResolucionAbsoluta()
    }

    private fun actualizarResolucionAbsoluta() {
        val windowManager = getSystemService(android.content.Context.WINDOW_SERVICE) as android.view.WindowManager
        val metrics = android.util.DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics) // Obtiene tamaño absoluto incluyendo barras del sistema
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        Log.d("RemoteControlAcc", "Resolución absoluta física: ${screenWidth}x${screenHeight}")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // Acceso Desatendido: Auto-aceptar diálogo de captura de pantalla
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: ""
            if (packageName == "com.android.systemui") {
                val node = rootInActiveWindow ?: return
                // Buscar botones de confirmación comunes en Android
                val textsToFind = listOf("Empezar ahora", "Start now", "Permitir", "Allow", "Comenzar")
                
                for (text in textsToFind) {
                    val nodes = node.findAccessibilityNodeInfosByText(text)
                    for (target in nodes) {
                        if (target.isClickable) {
                            Log.d("RemoteControlAcc", "Auto-click realizado en: $text")
                            target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            return
                        }
                        // A veces el botón padre es el clickeable
                        var parent = target.parent
                        while (parent != null) {
                            if (parent.isClickable) {
                                Log.d("RemoteControlAcc", "Auto-click en padre de: $text")
                                parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                                return
                            }
                            parent = parent.parent
                        }
                    }
                }
            }
        }
    }

    override fun onInterrupt() {
        Log.d("RemoteControlAcc", "Accessibility Service interrumpido")
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        if (instance == this) {
            instance = null
        }
        return super.onUnbind(intent)
    }

    fun performTap(xPercent: Float, yPercent: Float) {
        // Actualizar la resolución en cada toque para evitar errores si el dispositivo rotó (Landscape/Portrait)
        actualizarResolucionAbsoluta()

        val x = xPercent * screenWidth
        val y = yPercent * screenHeight

        Log.d("RemoteControlAcc", "Ejecutando tap en $x, $y ($xPercent, $yPercent)")

        val path = Path()
        path.moveTo(x, y)
        path.lineTo(x, y)

        val gestureBuilder = GestureDescription.Builder()
        val stroke = GestureDescription.StrokeDescription(path, 0, 100)
        gestureBuilder.addStroke(stroke)

        dispatchGesture(gestureBuilder.build(), null, null)
    }

    fun injectKey(key: String) {
        // Acciones Globales
        when (key) {
            "Escape" -> { performGlobalAction(GLOBAL_ACTION_BACK); return }
            "Home" -> { performGlobalAction(GLOBAL_ACTION_HOME); return }
            "Tab" -> { performGlobalAction(GLOBAL_ACTION_RECENTS); return }
            "ArrowUp" -> { scrollDirection("Up"); return }
            "ArrowDown" -> { scrollDirection("Down"); return }
            "ArrowLeft" -> { scrollDirection("Left"); return }
            "ArrowRight" -> { scrollDirection("Right"); return }
        }

        val rootNode = rootInActiveWindow ?: return
        val focusNode = rootNode.findFocus(android.view.accessibility.AccessibilityNodeInfo.FOCUS_INPUT)
        
        if (focusNode == null) {
            android.util.Log.w("RemoteControlAcc", "No hay campo de texto enfocado para inyectar: $key")
            return
        }

        // Manejar teclas especiales y de escritura en campos de texto
        when (key) {
            "Backspace" -> {
                val currentText = focusNode.text?.toString() ?: ""
                if (currentText.isNotEmpty()) {
                    val arguments = android.os.Bundle()
                    arguments.putCharSequence(
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        currentText.substring(0, currentText.length - 1)
                    )
                    focusNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                }
            }
            "Enter" -> {
                val currentText = focusNode.text?.toString() ?: ""
                val arguments = android.os.Bundle()
                arguments.putCharSequence(
                    android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    currentText + "\n"
                )
                focusNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
            }
            else -> {
                // Letras normales
                if (key.length == 1) {
                    val currentText = focusNode.text?.toString() ?: ""
                    val arguments = android.os.Bundle()
                    arguments.putCharSequence(
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        currentText + key
                    )
                    focusNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                }
            }
        }
    }

    private fun scrollDirection(direction: String) {
        if (screenWidth == 0 || screenHeight == 0) return
        
        val cx = screenWidth / 2f
        val cy = screenHeight / 2f
        val offset = screenHeight * 0.3f // 30% del alto para scroll
        
        val path = android.graphics.Path()
        when (direction) {
            "Up" -> { path.moveTo(cx, cy); path.lineTo(cx, cy + offset) } // Swipe abajo = scroll arriba
            "Down" -> { path.moveTo(cx, cy); path.lineTo(cx, cy - offset) } // Swipe arriba = scroll abajo
            "Left" -> { path.moveTo(cx, cy); path.lineTo(cx + offset, cy) } // Swipe derecha = scroll izquierda
            "Right" -> { path.moveTo(cx, cy); path.lineTo(cx - offset, cy) } // Swipe izquierda = scroll derecha
        }
        
        val stroke = android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 300)
        val gesture = android.accessibilityservice.GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, null, null)
    }
}
