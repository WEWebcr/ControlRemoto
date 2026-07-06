package com.controlremoto.client

import android.os.Environment
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FileManagerService {

    private val TAG = "FileManagerService"
    private var currentUploadStream: FileOutputStream? = null
    private var currentUploadFile: File? = null

    // Obtener la raíz del almacenamiento externo
    fun getRootPath(): String {
        return Environment.getExternalStorageDirectory().absolutePath
    }

    // Listar archivos de un directorio y devolverlos como JSON
    fun listDirectory(path: String): String {
        val jsonArray = JSONArray()
        try {
            val dir = File(path)
            if (!dir.exists() || !dir.isDirectory) {
                return "{\"error\": \"Directorio no existe o no es accesible\"}"
            }

            // Añadir botón "Subir directorio" simulado
            if (dir.absolutePath != getRootPath()) {
                val parentObj = JSONObject()
                parentObj.put("name", "..")
                parentObj.put("type", "folder")
                parentObj.put("path", dir.parentFile?.absolutePath ?: getRootPath())
                parentObj.put("size", "")
                parentObj.put("date", "")
                jsonArray.put(parentObj)
            }

            val files = dir.listFiles()
            if (files != null) {
                // Ordenar: primero carpetas, luego archivos, limitar a 200 elementos por límites de WebRTC
                files.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))
                    .take(200)
                    .forEach { file ->
                    val obj = JSONObject()
                    obj.put("name", file.name)
                    obj.put("path", file.absolutePath)
                    obj.put("type", if (file.isDirectory) "folder" else "file")
                    obj.put("size", if (file.isDirectory) "" else formatSize(file.length()))
                    obj.put("date", formatDate(file.lastModified()))
                    jsonArray.put(obj)
                }
            }
            
            val result = JSONObject()
            result.put("currentPath", path)
            result.put("files", jsonArray)
            return result.toString()
            
        } catch (e: Exception) {
            Log.e(TAG, "Error listando directorio", e)
            return "{\"error\": \"${e.message}\"}"
        }
    }

    // Preparar lectura de un archivo para descarga
    fun readFileChunks(path: String, onChunk: (ByteArray) -> Unit, onComplete: () -> Unit, onError: (String) -> Unit) {
        Thread {
            try {
                val file = File(path)
                if (!file.exists() || !file.isFile) {
                    onError("Archivo no válido")
                    return@Thread
                }
                
                val inputStream = FileInputStream(file)
                val buffer = ByteArray(64 * 1024) // 64KB chunks para WebRTC
                var bytesRead: Int
                
                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    // Si leemos menos del buffer completo, cortamos el array
                    val chunk = if (bytesRead == buffer.size) buffer else buffer.copyOf(bytesRead)
                    onChunk(chunk)
                    // Pequeña pausa para no saturar el buffer interno de WebRTC
                    Thread.sleep(5) 
                }
                
                inputStream.close()
                onComplete()
            } catch (e: Exception) {
                Log.e(TAG, "Error leyendo archivo", e)
                onError(e.message ?: "Error desconocido")
            }
        }.start()
    }

    // Iniciar recepción de un archivo (Upload)
    fun startUpload(path: String): Boolean {
        return try {
            val file = File(path)
            if (file.exists()) file.delete() // Sobrescribir
            
            currentUploadFile = file
            currentUploadStream = FileOutputStream(file)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error preparando upload: $path", e)
            false
        }
    }

    // Escribir chunk recibido
    fun writeChunk(data: ByteArray) {
        try {
            currentUploadStream?.write(data)
        } catch (e: Exception) {
            Log.e(TAG, "Error escribiendo chunk", e)
        }
    }

    // Finalizar recepción de archivo
    fun finishUpload(): Boolean {
        return try {
            currentUploadStream?.flush()
            currentUploadStream?.close()
            currentUploadStream = null
            currentUploadFile = null
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error cerrando stream de upload", e)
            false
        }
    }

    private fun formatSize(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format(Locale.US, "%.1f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format(Locale.US, "%.2f MB", mb)
        val gb = mb / 1024.0
        return String.format(Locale.US, "%.2f GB", gb)
    }

    private fun formatDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}
