plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

import java.util.Properties
import java.io.FileInputStream

val versionPropsFile = file("version.properties")
if (!versionPropsFile.exists()) {
    versionPropsFile.writeText("VERSION_CODE=0\n")
}
val versionProps = Properties().apply { load(FileInputStream(versionPropsFile)) }
var currentVersionCode = versionProps.getProperty("VERSION_CODE", "0").toInt()

if (gradle.startParameter.taskNames.any { it.contains("assemble") || it.contains("build") }) {
    currentVersionCode++
    versionProps.setProperty("VERSION_CODE", currentVersionCode.toString())
    versionProps.store(versionPropsFile.writer(), null)
}

base {
    archivesName.set("rostiremoteapk-v1.0.$currentVersionCode")
}

android {
    namespace = "com.controlremoto.client"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.controlremoto.client"
        minSdk = 26
        targetSdk = 34
        versionCode = currentVersionCode
        versionName = "1.0.$currentVersionCode"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    
    // WebRTC and Socket.io
    implementation("io.socket:socket.io-client:2.1.0")
    implementation("io.getstream:stream-webrtc-android:1.3.10")
}
