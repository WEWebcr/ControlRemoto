package com.controlremoto.client

import android.app.Service
import android.os.IBinder
import android.content.Intent
import android.util.Log
import android.widget.Toast
import org.webrtc.SessionDescription
import org.webrtc.MediaConstraints
import org.webrtc.SdpObserver
import org.webrtc.IceCandidate
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat

class RemoteControlService : Service() {

    private var webRTCClient: WebRTCClient? = null
    private var socketClient: SocketClient? = null
    private var isRemoteDescriptionSet = false
    private val pendingIceCandidates = mutableListOf<IceCandidate>()
    private var mediaProjectionData: Intent? = null

    private fun sendStatus(msg: String) {
        Log.d("RemoteControl", msg)
        val intent = Intent("ROSTI_STATUS")
        intent.putExtra("msg", msg)
        sendBroadcast(intent)
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        Log.d("RemoteControl", "Servicio WebRTC Creado")
        
        val channelId = "rosti_webrtc_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Control Remoto Activo", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
        
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Remoto Control J&M")
            .setContentText("Transmisión de pantalla activa")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()
            
        try {
            sendStatus("Iniciando ForegroundService...")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
            } else {
                startForeground(1, notification)
            }
            sendStatus("ForegroundService iniciado correctamente")
        } catch (e: Exception) {
            sendStatus("❌ ERROR CRÍTICO al iniciar servicio: ${e.message}")
            Log.e("RemoteControl", "Error startForeground", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "START_WEBRTC") {
            val roomId = intent.getStringExtra("ROOM_ID") ?: return super.onStartCommand(intent, flags, startId)
            @Suppress("DEPRECATION")
            val projectionData = intent.getParcelableExtra<Intent>("DATA") ?: return super.onStartCommand(intent, flags, startId)
            mediaProjectionData = projectionData

            val prefs = getSharedPreferences("RostiPrefs", android.content.Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("server_url", "https://remoto-control-jm.onrender.com") ?: "https://remoto-control-jm.onrender.com"

            sendStatus("Conectando a servidor de señalización...")
            Log.d("RemoteControl", "Iniciando WebRTC para la sala: $roomId")

            socketClient = SocketClient()
            
            socketClient?.onStatusChange = { msg -> sendStatus(msg) }
            
            socketClient?.onUserDisconnected = {
                Log.d("RemoteControl", "Admin se desconectó. Deteniendo transmisión WebRTC.")
                webRTCClient?.dispose()
                webRTCClient = null
            }
            
            socketClient?.connect(this, serverUrl, roomId,
                onOfferInit = { currentOffer ->
                    Log.d("RemoteControl", "Offer recibido, reiniciando sesión WebRTC...")
                    
                    // Liberar recursos de cualquier sesión previa
                    webRTCClient?.dispose()
                    webRTCClient = null
                    
                    isRemoteDescriptionSet = false
                    pendingIceCandidates.clear()

                    val projData = mediaProjectionData
                    if (projData != null) {
                        webRTCClient = WebRTCClient(this@RemoteControlService, socketClient!!, roomId, projData)
                    } else {
                        Log.e("RemoteControl", "mediaProjectionData es nulo, no se puede iniciar WebRTC")
                        return@connect
                    }
                    
                    webRTCClient?.peerConnection?.setRemoteDescription(object : SdpObserver {
                        override fun onSetSuccess() {
                            isRemoteDescriptionSet = true
                            pendingIceCandidates.forEach { candidate ->
                                webRTCClient?.peerConnection?.addIceCandidate(candidate)
                            }
                            pendingIceCandidates.clear()
                            
                            webRTCClient?.peerConnection?.createAnswer(object: SdpObserver {
                                override fun onCreateSuccess(desc: SessionDescription?) {
                                    desc?.let {
                                        webRTCClient?.peerConnection?.setLocalDescription(CustomSdpObserver("setLocalDescription"), it)
                                        val json = org.json.JSONObject()
                                        json.put("type", it.type.canonicalForm())
                                        json.put("sdp", it.description)
                                        socketClient?.emitAnswer(roomId, json)
                                    }
                                }
                                override fun onSetSuccess() {}
                                override fun onCreateFailure(p0: String?) {}
                                override fun onSetFailure(p0: String?) {}
                            }, MediaConstraints())
                        }
                        override fun onSetFailure(p0: String?) {}
                        override fun onCreateSuccess(p0: SessionDescription?) {}
                        override fun onCreateFailure(p0: String?) {}
                    }, SessionDescription(SessionDescription.Type.OFFER, currentOffer.getString("sdp")))
                },
                onAnswerInit = { },
                onIceCandidateInit = { data ->
                    val candidate = IceCandidate(data.getString("sdpMid"), data.getInt("sdpMLineIndex"), data.getString("candidate"))
                    if (isRemoteDescriptionSet) {
                        webRTCClient?.peerConnection?.addIceCandidate(candidate)
                    } else {
                        pendingIceCandidates.add(candidate)
                    }
                }
            )
        }
        return super.onStartCommand(intent, flags, startId)
    }

    class CustomSdpObserver(val tag: String): SdpObserver {
        override fun onCreateSuccess(p0: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(p0: String?) {}
        override fun onSetFailure(p0: String?) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d("RemoteControl", "Servicio Destruido")
        webRTCClient?.dispose()
        socketClient?.disconnect()
    }
}
