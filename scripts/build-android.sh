#!/usr/bin/env bash
# Build the Android debug APK. Requires the Android SDK (ANDROID_HOME or ~/Library/Android/sdk).
set -euo pipefail
cd "$(dirname "$0")/.."

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ ! -d "$SDK/platforms" ]; then
  echo "✖ Android SDK nicht gefunden unter: $SDK" >&2
  echo "  Installiere Android Studio / cmdline-tools und setze ANDROID_HOME," >&2
  echo "  z. B. export ANDROID_HOME=\"\$HOME/Library/Android/sdk\"" >&2
  exit 1
fi
export ANDROID_HOME="$SDK"

npm run build >/dev/null
npx cap sync android >/dev/null

echo "▶ Gradle assembleDebug"
./android/gradlew -p android :app:assembleDebug

APK="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "✖ APK wurde nicht erzeugt: $APK" >&2
  exit 1
fi
echo "✔ APK: $APK"
