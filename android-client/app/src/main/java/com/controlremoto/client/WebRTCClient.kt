package com.controlremoto.client

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import org.webrtc.*

class WebRTCClient(
    private val context: Context,
    private val socketClient: SocketClient,
    private val roomId: String,
    private val mediaProjectionPermissionResultData: Intent
) {
    var peerConnection: PeerConnection? = null
    private var factory: PeerConnectionFactory? = null
    var dataChannel: DataChannel? = null
    var fileChannel: DataChannel? = null
    private val eglBase = EglBase.create()
    private val fileManager = FileManagerService()

    private var videoCapturer: ScreenCapturerAndroid? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var videoSource: VideoSource? = null

    init {
        // Inicializar WebRTC
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(true)
                .createInitializationOptions()
        )

        val options = PeerConnectionFactory.Options()
        // Usamos hardware encoding que es mucho más rápido y estable para grabar pantalla
        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        
        factory = PeerConnectionFactory.builder()
            .setOptions(options)
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.relay.metered.ca:80").createIceServer(),
            PeerConnection.IceServer.builder("stun:global.relay.metered.ca:80").createIceServer(),
            PeerConnection.IceServer.builder("turn:global.relay.metered.ca:80")
                .setUsername("93d3531d6cb9d21936c44b01")
                .setPassword("1WRQmmSv2+K85BnG")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:global.relay.metered.ca:80?transport=tcp")
                .setUsername("93d3531d6cb9d21936c44b01")
                .setPassword("1WRQmmSv2+K85BnG")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:global.relay.metered.ca:443")
                .setUsername("93d3531d6cb9d21936c44b01")
                .setPassword("1WRQmmSv2+K85BnG")
                .createIceServer(),
            PeerConnection.IceServer.builder("turns:global.relay.metered.ca:443?transport=tcp")
                .setUsername("93d3531d6cb9d21936c44b01")
                .setPassword("1WRQmmSv2+K85BnG")
                .createIceServer()
        )
        
        peerConnection = factory?.createPeerConnection(iceServers, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    val json = org.json.JSONObject()
                    json.put("sdpMid", it.sdpMid)
                    json.put("sdpMLineIndex", it.sdpMLineIndex)
                    json.put("candidate", it.sdp)
                    socketClient.emitIceCandidate(roomId, json)
                }
            }
            override fun onDataChannel(channel: DataChannel?) {
                if (channel?.label() == "files") {
                    fileChannel = channel
                    fileChannel?.registerObserver(object: DataChannel.Observer {
                        override fun onMessage(buffer: DataChannel.Buffer?) {
                            val data = buffer?.data
                            if (data != null) {
                                val bytes = ByteArray(data.remaining())
                                data.get(bytes)
                                
                                // Si no es binario, es un comando JSON
                                if (!buffer.binary) {
                                    val message = String(bytes)
                                    try {
                                        val json = org.json.JSONObject(message)
                                        val cmd = json.optString("cmd")
                                        
                                        if (cmd == "LIST_DIR") {
                                            var path = json.optString("path")
                                            if (path.isEmpty()) {
                                                path = fileManager.getRootPath()
                                            }
                                            val result = fileManager.listDirectory(path)
                                            val response = org.json.JSONObject()
                                            response.put("type", "DIR_LIST")
                                            response.put("data", org.json.JSONObject(result))
                                            val outBuffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(response.toString().toByteArray()), false)
                                            fileChannel?.send(outBuffer)
                                        } else if (cmd == "REQ_DOWNLOAD") {
                                            val path = json.optString("path")
                                            val fileObj = java.io.File(path)
                                            
                                            val response = org.json.JSONObject()
                                            response.put("type", "DOWNLOAD_START")
                                            response.put("name", fileObj.name)
                                            response.put("size", fileObj.length())
                                            val outBuffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(response.toString().toByteArray()), false)
                                            fileChannel?.send(outBuffer)
                                            
                                            fileManager.readFileChunks(path, 
                                                onChunk = { chunk ->
                                                    val chunkBuffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(chunk), true)
                                                    fileChannel?.send(chunkBuffer)
                                                },
                                                onComplete = {
                                                    val endObj = org.json.JSONObject().apply { put("type", "DOWNLOAD_END") }
                                                    val endBuffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(endObj.toString().toByteArray()), false)
                                                    fileChannel?.send(endBuffer)
                                                },
                                                onError = { err ->
                                                    val errObj = org.json.JSONObject().apply { put("type", "DOWNLOAD_ERROR"); put("msg", err) }
                                                    val errBuffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(errObj.toString().toByteArray()), false)
                                                    fileChannel?.send(errBuffer)
                                                }
                                            )
                                        } else if (cmd == "UPLOAD_START") {
                                            val path = json.optString("path")
                                            fileManager.startUpload(path)
                                        } else if (cmd == "UPLOAD_END") {
                                            fileManager.finishUpload()
                                            // Confirmar que se subió
                                            val endObj = org.json.JSONObject().apply { put("type", "UPLOAD_SUCCESS") }
                                            val endBuffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(endObj.toString().toByteArray()), false)
                                            fileChannel?.send(endBuffer)
                                        }
                                    } catch (e: Exception) {
                                        android.util.Log.e("WebRTCClient", "Error parseando comando de archivo: $message", e)
                                    }
                                } else {
                                    // Datos binarios (chunk de subida)
                                    fileManager.writeChunk(bytes)
                                }
                            }
                        }
                        override fun onStateChange() {}
                        override fun onBufferedAmountChange(p0: Long) {}
                    })
                } else {
                    dataChannel = channel
                    dataChannel?.registerObserver(object: DataChannel.Observer {
                        override fun onMessage(buffer: DataChannel.Buffer?) {
                            val data = buffer?.data
                            if (data != null && !buffer.binary) {
                                val bytes = ByteArray(data.remaining())
                                data.get(bytes)
                                val message = String(bytes)
                                try {
                                    val json = org.json.JSONObject(message)
                                    val type = json.optString("type")
                                    if (type == "down" || type == "click") {
                                        val x = json.optDouble("x", -1.0).toFloat()
                                        val y = json.optDouble("y", -1.0).toFloat()
                                        if (x >= 0 && y >= 0) {
                                            RemoteControlAccessibilityService.instance?.performTap(x, y)
                                        }
                                    } else if (type == "key") {
                                        val key = json.optString("key")
                                        if (key.isNotEmpty()) {
                                            RemoteControlAccessibilityService.instance?.injectKey(key)
                                        }
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("WebRTCClient", "Error parseando DataChannel msg: $message", e)
                                }
                            }
                        }
                        override fun onStateChange() {}
                        override fun onBufferedAmountChange(p0: Long) {}
                    })
                }
            }
            // Implementaciones requeridas
            override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
            override fun onAddStream(p0: MediaStream?) {}
            override fun onRemoveStream(p0: MediaStream?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(p0: RtpReceiver?, p1: Array<out MediaStream>?) {}
        })

        startScreenCapture()
    }

    private fun startScreenCapture() {
        val capturer = ScreenCapturerAndroid(mediaProjectionPermissionResultData, object : MediaProjection.Callback() {})
        videoCapturer = capturer
        
        val textureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        surfaceTextureHelper = textureHelper
        
        val source = factory?.createVideoSource(capturer.isScreencast)
        videoSource = source
        
        capturer.initialize(textureHelper, context, source?.capturerObserver)
        
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        val metrics = android.util.DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)
        var width = metrics.widthPixels
        var height = metrics.heightPixels
        
        // Limitar resolución para evitar que el encoder falle por tamaño excesivo
        val MAX_RES = 1280
        if (Math.max(width, height) > MAX_RES) {
            val ratio = width.toFloat() / height.toFloat()
            if (width > height) {
                width = MAX_RES
                height = (MAX_RES / ratio).toInt()
            } else {
                height = MAX_RES
                width = (MAX_RES * ratio).toInt()
            }
        }

        // Asegurar que sean números pares (los encoders de video suelen requerirlo)
        width = (width / 2) * 2
        height = (height / 2) * 2
        
        // Resolución dinámica y segura
        capturer.startCapture(width, height, 30) 

        val videoTrack = factory?.createVideoTrack("100", source)
        val sender = peerConnection?.addTrack(videoTrack, listOf("screen_stream"))
        
        // Limitar el bitrate a nivel de red (800 kbps) para evitar saturación y congelamiento
        // Esto es mucho más seguro que bajar los FPS de captura, ya que no rompe el encoder de hardware
        try {
            val parameters = sender?.parameters
            if (parameters != null) {
                for (encoding in parameters.encodings) {
                    encoding.maxBitrateBps = 800000 // 800 kbps
                }
                sender.parameters = parameters
            }
        } catch (e: Exception) {
            android.util.Log.e("WebRTCClient", "Error limitando bitrate", e)
        }
    }

    fun dispose() {
        android.util.Log.d("WebRTCClient", "Disposing WebRTCClient resources...")
        try {
            videoCapturer?.stopCapture()
            videoCapturer?.dispose()
        } catch (e: Exception) {
            android.util.Log.e("WebRTCClient", "Error stopping videoCapturer: ${e.message}")
        }
        try {
            surfaceTextureHelper?.dispose()
        } catch (e: Exception) {
            android.util.Log.e("WebRTCClient", "Error disposing surfaceTextureHelper: ${e.message}")
        }
        try {
            videoSource?.dispose()
        } catch (e: Exception) {
            android.util.Log.e("WebRTCClient", "Error disposing videoSource: ${e.message}")
        }
        try {
            dataChannel?.close()
            fileChannel?.close()
        } catch (e: Exception) {}
        try {
            peerConnection?.close()
        } catch (e: Exception) {}
        try {
            factory?.dispose()
        } catch (e: Exception) {}
        try {
            eglBase.release()
        } catch (e: Exception) {}
        
        videoCapturer = null
        surfaceTextureHelper = null
        videoSource = null
        peerConnection = null
        factory = null
        dataChannel = null
        fileChannel = null
        android.util.Log.d("WebRTCClient", "WebRTCClient resources disposed.")
    }
}
