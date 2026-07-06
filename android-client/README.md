# Proyecto Android Client (APK)

Este directorio contiene los archivos fuente clave para la aplicación Android de Control Remoto.

## Instrucciones para compilar en Android Studio

Para asegurar compatibilidad y correcto empaquetado del APK (Android 8.0+), sigue estos pasos:

1.  Abre **Android Studio** y selecciona **"New Project"**.
2.  Elige la plantilla **"Empty Activity"** o **"Empty Views Activity"** (no Compose, para mantener simplicidad con las librerías WebRTC estándar).
3.  Asigna el nombre **ControlRemoto** y el paquete `com.controlremoto.client`.
4.  Selecciona **Kotlin** y Minimum SDK **API 26 (Android 8.0)**.
5.  Una vez creado el proyecto, copia los archivos de la carpeta `src/` de este directorio hacia la carpeta `app/src/main/java/com/controlremoto/client/` en tu nuevo proyecto.
6.  **Dependencias:** Abre tu archivo `build.gradle.kts` (Module :app) y agrega:
    ```kotlin
    implementation("io.socket:socket.io-client:2.1.0")
    implementation("org.webrtc:google-webrtc:1.0.32006")
    ```
7.  **Permisos:** En el `AndroidManifest.xml`, asegúrate de incluir:
    ```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    
    <service 
        android:name=".RemoteControlService"
        android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
        android:exported="true">
        <intent-filter>
            <action android:name="android.accessibilityservice.AccessibilityService" />
        </intent-filter>
        <meta-data
            android:name="android.accessibilityservice"
            android:resource="@xml/accessibility_service_config" />
    </service>
    ```

Con esto, podrás compilar el APK para probar en tus Tabletas y TVs.
