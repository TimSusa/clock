#!/usr/bin/env bash
# Install the built app on a USB-connected device.
#   PLATFORM=ios|android|auto (default auto)
#   IOS_APP=<path to .app>   (optional, defaults to the device build output)
#   ANDROID_APK=<path>       (optional, defaults to app-debug.apk)
# Requires: Xcode (iOS) / Android SDK platform-tools + USB debugging (Android).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=device.sh
. "$(dirname "$0")/device.sh"

PLATFORM="${PLATFORM:-auto}"
DERIVED="${DERIVED_DATA:-/tmp/clock-derived}"

deploy_android() {
  local apk="${ANDROID_APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
  local adb_bin="${ADB:-}"
  if [ -z "$adb_bin" ]; then
    local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
    if [ -x "$sdk/platform-tools/adb" ]; then
      adb_bin="$sdk/platform-tools/adb"
    else
      adb_bin="$(command -v adb || true)"
    fi
  fi
  if [ -z "$adb_bin" ]; then
    echo "✖ adb nicht gefunden (Android SDK platform-tools noetig)." >&2
    return 1
  fi
  if [ ! -f "$apk" ]; then
    echo "✖ APK fehlt: $apk — erst 'npm run build:android' ausfuehren." >&2
    return 1
  fi
  local devices
  devices="$($adb_bin devices | awk 'NR>1 && $2=="device" {print $1}')"
  if [ -z "$devices" ]; then
    echo "✖ Kein Android-Geraet per USB verbunden (adb devices zeigt keins)." >&2
    echo "  USB-Debugging aktivieren und das Geraet autorisieren." >&2
    return 1
  fi
  echo "▶ Android-Geraete: $devices"
  for serial in $devices; do
    echo "▶ Installiere auf $serial"
    "$adb_bin" -s "$serial" install -r "$apk"
  done
  echo "✔ Android-Installation abgeschlossen."
}

deploy_ios() {
  local app="${IOS_APP:-$DERIVED/device/Build/Products/Debug-iphoneos/App.app}"
  if [ ! -d "$app" ]; then
    echo "✖ .app fehlt: $app" >&2
    echo "  Erst bauen: DEVICE=1 DEVELOPMENT_TEAM=<TEAM> npm run build:ios" >&2
    return 1
  fi
  if ! command -v xcrun >/dev/null 2>&1; then
    echo "✖ Xcode / xcrun fehlt." >&2
    return 1
  fi
  local devices
  devices="$(target_udids)"
  if [ -z "$devices" ]; then
    echo "✖ Kein physisches iOS-Geraet per USB erkannt." >&2
    echo "  Geraet anschliessen, entsperren und 'Diesem Computer vertrauen' bestaetigen." >&2
    return 1
  fi
  echo "▶ iOS-Geraete: $devices"
  for udid in $devices; do
    echo "▶ Installiere auf $udid"
    xcrun devicectl device install app --device "$udid" "$app"
    if [ "${LAUNCH:-0}" = "1" ]; then
      echo "▶ Starte und pruefe Readiness auf $udid"
      xcrun devicectl device process launch --device "$udid" de.timsusa.clock
    fi
  done
  echo "✔ iOS-Installation abgeschlossen. (LAUNCH=1 startet die App zusaetzlich.)"
}

case "$PLATFORM" in
  ios)     deploy_ios ;;
  android) deploy_android ;;
  auto)
    ios_ok=0
    android_ok=0
    deploy_ios || ios_ok=$?
    deploy_android || android_ok=$?
    if [ "$ios_ok" -ne 0 ] && [ "$android_ok" -ne 0 ]; then
      echo "✖ Auf keinem angeschlossenen Geraet installiert." >&2
      exit 1
    fi
    ;;
  *)
    echo "✖ Unbekannte PLATFORM: $PLATFORM (ios|android|auto)" >&2
    exit 1
    ;;
esac
