export const ANDROID_STARTER_FILES = [
  {
    name: "build.sh",
    path: "/workspace/build.sh",
    type: "file",
    language: "shell",
    content: `#!/bin/bash
echo "=== Starting Gradle Android Build ==="
cd /workspace
./gradlew assembleDebug --no-daemon
STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo "BUILD SUCCESSFUL"
  if [ -f /workspace/app/build/outputs/apk/debug/app-debug.apk ]; then
    echo "APK Generated: /workspace/app/build/outputs/apk/debug/app-debug.apk"
  else
    echo "APK Generated but not found in default path."
  fi
else
  echo "Build Failed"
  echo "Compilation Errors (Exit Code: $STATUS)"
  exit $STATUS
fi
`
  },
  {
    name: "gradlew",
    path: "/workspace/gradlew",
    type: "file",
    language: "shell",
    content: `#!/bin/sh

# Resolve links: $0 may be a link
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=\`ls -ld "$PRG"\`
    link=\`expr "$ls" : '.*-> \\(.*\\)$'\`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=\`dirname "$PRG"\`/"$link"
    fi
done
SAVED="\`pwd\`"
cd "\`dirname \\"$PRG\\"\`" >/dev/null
APP_HOME="\`pwd\`"
cd "$SAVED" >/dev/null

APP_NAME="Gradle"
APP_BASE_NAME=\`basename "$0"\`
CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

# Determine the Java command to use to start the JVM.
if [ -n "$JAVA_HOME" ] ; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi

if ! command -v "$JAVACMD" >/dev/null 2>&1; then
    # Fallback to direct gradle command if java fails or isn't set,
    # or print a error.
    if command -v gradle >/dev/null 2>&1; then
        exec gradle "$@"
    else
        echo "ERROR: JAVA_HOME is not set and no 'java' command could be found."
        exit 1
    fi
fi

exec "$JAVACMD" \
  "-Dorg.gradle.appname=$APP_BASE_NAME" \
  -classpath "$CLASSPATH" \
  org.gradle.wrapper.GradleWrapperMain \
  "$@"
`
  },
  {
    name: "settings.gradle",
    path: "/workspace/settings.gradle",
    type: "file",
    language: "gradle",
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "LifecycleExample"
include ':app'
`
  },
  {
    name: "build.gradle",
    path: "/workspace/build.gradle",
    type: "file",
    language: "gradle",
    content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id 'com.android.application' version '8.2.0' apply false
    id 'com.android.library' version '8.2.0' apply false
}
`
  },
  {
    name: "build.gradle",
    path: "/workspace/app/build.gradle",
    type: "file",
    language: "gradle",
    content: `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.example.lifecycleexample'
    compileSdk 34

    defaultConfig {
        applicationId "com.example.lifecycleexample"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
}
`
  },
  {
    name: "MainActivity.java",
    path: "/workspace/app/src/main/java/com/example/lifecycleexample/MainActivity.java",
    type: "file",
    language: "java",
    content: `package com.example.lifecycleexample;

import android.os.Bundle;
import android.util.Log;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        Log.d(TAG, "onCreate called");
    }

    @Override
    protected void onStart() {
        super.onStart();
        Log.d(TAG, "onStart called");
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume called");
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause called");
    }

    @Override
    protected void onStop() {
        super.onStop();
        Log.d(TAG, "onStop called");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy called");
    }
}
`
  },
  {
    name: "activity_main.xml",
    path: "/workspace/app/src/main/res/layout/activity_main.xml",
    type: "file",
    language: "xml",
    content: `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <TextView
        android:id="@+id/textView"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Hello, Android Lab!"
        android:textSize="24sp"
        android:layout_centerInParent="true" />

</RelativeLayout>
`
  },
  {
    name: "AndroidManifest.xml",
    path: "/workspace/app/src/main/AndroidManifest.xml",
    type: "file",
    language: "xml",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:label="LifecycleExample"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`
  }
];
