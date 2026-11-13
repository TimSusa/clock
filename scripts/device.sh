#!/usr/bin/env bash
# Single source of truth for discovering the USB-connected physical iOS device.
# Sourced by build-ios.sh, deploy-device.sh and go-live.sh — never re-parse
# `devicectl list devices` in more than one place.
# Set DEVICE_UDID to target a specific device when more than one is connected.

physical_udids() {
	xcrun devicectl list devices 2>/dev/null |
		awk '/\(UDID\)/ && $0 !~ /simulated/ && $0 ~ /available|connected/ {print $3}'
}

target_udids() {
	if [ -n "${DEVICE_UDID:-}" ]; then
		printf '%s\n' "$DEVICE_UDID"
	else
		physical_udids
	fi
}

first_physical_udid() {
	target_udids | head -1
}

device_destination() {
	printf 'platform=iOS,id=%s' "$(first_physical_udid)"
}
