#!/usr/bin/env bash
# Single source of truth for discovering the USB-connected physical iOS device.
# Sourced by build-ios.sh, deploy-device.sh and go-live.sh — never re-parse
# `devicectl list devices` in more than one place.

physical_udids() {
	xcrun devicectl list devices 2>/dev/null |
		awk '/\(UDID\)/ && $0 !~ /simulated/ && $0 ~ /available|connected/ {print $3}'
}

first_physical_udid() {
	physical_udids | head -1
}

device_destination() {
	printf 'platform=iOS,id=%s' "$(first_physical_udid)"
}
