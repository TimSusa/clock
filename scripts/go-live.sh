#!/usr/bin/env bash
# One-shot: build for the USB-connected iPhone, install it and launch it.
# Requires: Xcode signed in with an Apple ID, Developer Mode enabled, trusted USB pairing.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DEVELOPMENT_TEAM:?Set DEVELOPMENT_TEAM to your Xcode Personal Team ID}"

echo "▶ Checking for a physical device"
DEVICES="$(xcrun devicectl list devices 2>/dev/null | awk '/\(UDID\)/ && $0 !~ /simulated/ && $0 ~ /available|connected/ {print $3}' || true)"
if [ -z "$DEVICES" ]; then
  echo "✖ No physical iOS device found over USB." >&2
  exit 1
fi
echo "✔ Device(s): $DEVICES"

echo "▶ Building signed device app"
npm run cap:sync >/dev/null
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphoneos \
  -destination 'generic/platform=iOS' \
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
for udid in $DEVICES; do
  xcrun devicectl device install app --device "$udid" "$APP"
done
echo "✔ Installed"

if [ "${LAUNCH:-1}" = "1" ]; then
  echo "▶ Launching"
  for udid in $DEVICES; do
    xcrun devicectl device process launch --device "$udid" de.timsusa.clock
  done
  echo "✔ Launched — check your iPhone screen."
fi
