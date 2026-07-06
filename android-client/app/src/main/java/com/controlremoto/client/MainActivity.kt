package com.controlremoto.client

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.app.AlertDialog
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.os.Build
import android.os.Environment
import android.net.Uri
import androidx.core.app.ActivityCompat
import android.content.pm.PackageManager

class MainActivity : Activity() {

    private lateinit var mediaProjectionManager: MediaProjectionManager
    private val SCREEN_CAPTURE_REQUEST_CODE = 1000
    private var generatedCode: String = ""

    companion object {
        var isTransmissionIntentHandled = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        val tvRoomCode = findViewById<TextView>(R.id.tvRoomCode)
        val tvStatus = findViewById<TextView>(R.id.tvStatus)
        val btnConnect = findViewById<Button>(R.id.btnConnect)
        val btnAccessibility = findViewById<Button>(R.id.btnAccessibility)
        val layoutLogin = findViewById<LinearLayout>(R.id.layoutLogin)
        val layoutDashboard = findViewById<LinearLayout>(R.id.layoutDashboard)
        val etUser = findViewById<EditText>(R.id.etUser)
        val etPass = findViewById<EditText>(R.id.etPass)
        val btnLogin = findViewById<Button>(R.id.btnLogin)
        val btnSettings = findViewById<Button>(R.id.btnSettings)
        val etOwner = findViewById<EditText>(R.id.etOwner)

        // Receptor de mensajes de diagnóstico del servicio
        val statusReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val msg = intent?.getStringExtra("msg") ?: return
                val current = tvStatus.text.toString()
                val lines = current.split("\n").takeLast(8)
                tvStatus.text = (lines + msg).joinToString("\n")
            }
        }
        registerReceiver(statusReceiver, IntentFilter("ROSTI_STATUS"), Context.RECEIVER_NOT_EXPORTED)

        val prefs = getSharedPreferences("RostiPrefs", Context.MODE_PRIVATE)
        val isLoggedIn = prefs.getBoolean("is_logged_in", false)

        // Hilo de autodescubrimiento de IP local por UDP
        Thread {
            try {
                val socket = java.net.DatagramSocket(44444)
                val buffer = ByteArray(1024)
                val packet = java.net.DatagramPacket(buffer, buffer.size)
                while (true) {
                    socket.receive(packet)
                    val message = String(packet.data, 0, packet.length)
                    if (message.startsWith("ROSTI_SERVER:")) {
                        val senderIP = packet.address.hostAddress
                        val port = message.split(":")[1].trim()
                        val autoUrl = "http://$senderIP:$port"
                        
                        val isRemote = prefs.getBoolean("use_remote", false)
                        if (!isRemote) {
                            val currentUrl = prefs.getString("server_url", "")
                            if (currentUrl != autoUrl) {
                                prefs.edit().putString("server_url", autoUrl).apply()
                                runOnUiThread {
                                    Toast.makeText(this@MainActivity, "Servidor local detectado: $autoUrl", Toast.LENGTH_LONG).show()
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()

        if (isLoggedIn) {
            layoutLogin.visibility = LinearLayout.GONE
            layoutDashboard.visibility = LinearLayout.VISIBLE
            
            // Cargar o generar ID estático
            generatedCode = prefs.getString("permanent_id", "") ?: ""
            if (generatedCode.isEmpty()) {
                val randomNum = (100000..999999).random()
                generatedCode = "${randomNum.toString().substring(0, 3)}-${randomNum.toString().substring(3, 6)}"
                prefs.edit().putString("permanent_id", generatedCode).apply()
            }
            tvRoomCode.text = generatedCode
            
            etOwner.setText(prefs.getString("device_owner", ""))
            
            if (intent?.action == "ACTION_START_TRANSMISSION" && !isTransmissionIntentHandled) {
                isTransmissionIntentHandled = true
                // Limpiar la acción para que no se vuelva a ejecutar en reanudaciones
                intent.action = ""
                setIntent(intent)
                
                tvStatus.text = "Iniciando captura solicitada en segundo plano..."
                startScreenCapture()
            } else {
                tvStatus.text = "Servicio en segundo plano activo. Esperando conexión..."
            }
        } else {
            layoutLogin.visibility = LinearLayout.VISIBLE
            layoutDashboard.visibility = LinearLayout.GONE
        }

        btnLogin.setOnClickListener {
            val user = etUser.text.toString().trim()
            val pass = etPass.text.toString().trim()
            
            if (user == "soporte" && pass == "R0st1p021") {
                prefs.edit().putBoolean("is_logged_in", true).apply()
                
                val randomNum = (100000..999999).random()
                generatedCode = "${randomNum.toString().substring(0, 3)}-${randomNum.toString().substring(3, 6)}"
                prefs.edit().putString("permanent_id", generatedCode).apply()
                
                tvRoomCode.text = generatedCode
                layoutLogin.visibility = LinearLayout.GONE
                layoutDashboard.visibility = LinearLayout.VISIBLE
                
                startScreenCapture()
            } else {
                Toast.makeText(this, "Credenciales incorrectas", Toast.LENGTH_SHORT).show()
            }
        }

        btnConnect.setOnClickListener {
            val ownerName = etOwner.text.toString().trim()
            prefs.edit().putString("device_owner", ownerName).apply()
            Toast.makeText(this, "Propietario guardado: $ownerName", Toast.LENGTH_SHORT).show()
            startScreenCapture()
        }

        btnAccessibility.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        // Nuevo botón/lógica para Permisos de Archivos si hace falta
        val btnFiles = Button(this).apply { text = "Permiso de Archivos" }
        btnFiles.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                        intent.addCategory("android.intent.category.DEFAULT")
                        intent.data = Uri.parse(String.format("package:%s", applicationContext.packageName))
                        startActivityForResult(intent, 2000)
                    } catch (e: Exception) {
                        val intent = Intent()
                        intent.action = Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION
                        startActivityForResult(intent, 2000)
                    }
                } else {
                    Toast.makeText(this, "Permiso ya concedido", Toast.LENGTH_SHORT).show()
                }
            } else {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE, android.Manifest.permission.READ_EXTERNAL_STORAGE),
                    2001
                )
            }
        }
        layoutDashboard.addView(btnFiles)

        // Botón para ingresar a la Consola de Administración (Modo Administrador)
        val btnAdmin = Button(this).apply {
            text = "🔧 ABRIR CONSOLA DE ADMIN"
            backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#FF5722"))
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            val density = resources.displayMetrics.density
            val heightPx = (60 * density).toInt()
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                heightPx
            ).apply {
                setMargins(0, 0, 0, (16 * density).toInt())
            }
        }
        btnAdmin.setOnClickListener {
            val serverUrl = prefs.getString("server_url", "https://remoto-control-jm.onrender.com")
            val intent = Intent(this, AdminConsoleActivity::class.java).apply {
                putExtra("URL", "$serverUrl/admin")
            }
            startActivity(intent)
        }
        layoutDashboard.addView(btnAdmin)

        btnSettings.setOnClickListener {
            val isRemote = prefs.getBoolean("use_remote", false)
            val options = arrayOf("☁️ Servidor Remoto (Nube)", "💻 Servidor Local (Auto-Detección)")
            val checkedItem = if (isRemote) 0 else 1
            
            AlertDialog.Builder(this)
                .setTitle("Seleccionar Servidor")
                .setSingleChoiceItems(options, checkedItem) { dialog, which ->
                    if (which == 0) {
                        dialog.dismiss()
                        
                        val input = android.widget.EditText(this@MainActivity)
                        input.hint = "https://..."
                        input.setText(prefs.getString("server_url", "https://remoto-control-jm.onrender.com"))
                        
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("Configurar Nube")
                            .setMessage("Ingresa la URL del servidor en la nube:")
                            .setView(input)
                            .setPositiveButton("Guardar") { _, _ ->
                                val url = input.text.toString().trim()
                                prefs.edit().putBoolean("use_remote", true).apply()
                                prefs.edit().putString("server_url", if (url.isEmpty()) "https://remoto-control-jm.onrender.com" else url).apply()
                                Toast.makeText(this@MainActivity, "Modo Nube activado. Reinicia la transmisión.", Toast.LENGTH_LONG).show()
                            }
                            .setNegativeButton("Cancelar", null)
                            .show()
                    } else {
                        prefs.edit().putBoolean("use_remote", false).apply()
                        Toast.makeText(this@MainActivity, "Modo Local activado. Esperando detección...", Toast.LENGTH_LONG).show()
                        dialog.dismiss()
                    }
                }
                .setNegativeButton("Cancelar", null)
                .show()
        }
    }

    private fun startScreenCapture() {
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        startActivityForResult(captureIntent, SCREEN_CAPTURE_REQUEST_CODE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == SCREEN_CAPTURE_REQUEST_CODE) {
            if (resultCode == RESULT_OK && data != null) {
                // Iniciar servicio en primer plano y pasar el intent de MediaProjection
                val serviceIntent = Intent(this, RemoteControlService::class.java).apply {
                    action = "START_WEBRTC"
                    putExtra("RESULT_CODE", resultCode)
                    putExtra("DATA", data)
                    putExtra("ROOM_ID", generatedCode)
                }
                
                try {
                    val tvStatus = findViewById<TextView>(R.id.tvStatus)
                    tvStatus.text = "Lanzando servicio de captura...\n"
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent)
                    } else {
                        startService(serviceIntent)
                    }
                    Toast.makeText(this, "Transmisión iniciada", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    val tvStatus = findViewById<TextView>(R.id.tvStatus)
                    tvStatus.text = "ERROR FATAL: ${e.message}\n"
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } else {
                Toast.makeText(this, "Permiso de captura de pantalla denegado", Toast.LENGTH_SHORT).show()
            }
        }
    }
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent?.action == "ACTION_START_TRANSMISSION" && !isTransmissionIntentHandled) {
            isTransmissionIntentHandled = true
            // Limpiar la acción para que no se vuelva a ejecutar si la actividad se reanuda
            intent.action = ""
            setIntent(intent)
            
            val tvStatus = findViewById<TextView>(R.id.tvStatus)
            tvStatus.text = "Iniciando captura solicitada en segundo plano..."
            startScreenCapture()
        }
    }
}
