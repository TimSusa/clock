#!/usr/bin/env bash
# Build the iOS app. Simulator by default; set DEVICE=1 (+ DEVELOPMENT_TEAM) for hardware.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build >/dev/null
npx cap sync ios >/dev/null

DERIVED="${DERIVED_DATA:-/tmp/clock-derived}"
SIM="${SIMULATOR:-iPhone 16}"

if [ "${DEVICE:-0}" = "1" ]; then
  : "${DEVELOPMENT_TEAM:?DEVELOPMENT_TEAM is required for a device build (Apple Developer Team ID)}"
  echo "▶ iOS Device build (Team ${DEVELOPMENT_TEAM})"
  xcodebuild -project ios/App/App.xcodeproj -scheme App \
    -configuration Debug -sdk iphoneos \
    -destination 'generic/platform=iOS' \
    -derivedDataPath "$DERIVED/device" \
    DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
    CODE_SIGN_STYLE=Automatic \
    -allowProvisioningUpdates \
    -allowProvisioningDeviceRegistration build
  echo "✔ Device app: $DERIVED/device/Build/Products/Debug-iphoneos/App.app"
else
  echo "▶ iOS Simulator build ($SIM)"
  xcodebuild -project ios/App/App.xcodeproj -scheme App \
    -configuration Debug -sdk iphonesimulator \
    -destination "platform=iOS Simulator,name=$SIM" \
    -derivedDataPath "$DERIVED/simulator" \
    CODE_SIGNING_ALLOWED=NO build
  echo "✔ Simulator app: $DERIVED/simulator/Build/Products/Debug-iphonesimulator/App.app"
fi
