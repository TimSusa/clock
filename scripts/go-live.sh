#!/usr/bin/env bash
# One-shot: build for the USB-connected iPhone, install it and launch it.
# Requires: Xcode signed in with an Apple ID, Developer Mode enabled, trusted USB pairing.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=device.sh
. "$(dirname "$0")/device.sh"

: "${DEVELOPMENT_TEAM:?Set DEVELOPMENT_TEAM to your Xcode Personal Team ID}"

echo "▶ Checking for a physical device"
UDID="$(first_physical_udid)"
if [ -z "$UDID" ]; then
  echo "✖ No physical iOS device found over USB." >&2
  exit 1
fi
echo "✔ Device: $UDID"

echo "▶ Building signed device app"
npm run cap:sync >/dev/null
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphoneos \
  -destination "platform=iOS,id=$UDID" \
  -derivedDataPath /tmp/clock-derived/device \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration build >/tmp/clock-device-build.log 2>&1 || {
    echo "✖ Build failed — tail of log:" >&2
    tail -20 /tmp/clock-device-build.log >&2
    exit 1
  }
echo "✔ Build succeeded"

APP="/tmp/clock-derived/device/Build/Products/Debug-iphoneos/App.app"
echo "▶ Installing on device"
xcrun devicectl device install app --device "$UDID" "$APP"
echo "✔ Installed"

if [ "${LAUNCH:-1}" = "1" ]; then
  echo "▶ Launching"
  xcrun devicectl device process launch --device "$UDID" de.timsusa.clock
  echo "✔ Launched — check your iPhone screen."
fi
