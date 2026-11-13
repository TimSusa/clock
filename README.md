# Clock

> A single-list alarm & appointment app where **every event owns its own sound** — built as a production-grade, cross-platform reference project.

[![Stack](https://img.shields.io/badge/Svelte-5-ff3e00)](#tech-stack) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#tech-stack) [![Tests](https://img.shields.io/badge/tests-408%20passing-brightgreen)](#quality-gates) [![Platforms](https://img.shields.io/badge/Web%20%7C%20iOS%20%7C%20Android-blue)](#mobile-capacitor)

---

## The idea, in one paragraph

Most calendar apps treat the notification sound as a **global setting**. Clock flips that: a 7:00 workout, a 15:30 dentist appointment and a 24.12 family dinner can each ring differently — a bundled track, a local audio file from the device, or a recording made with the microphone. One list, one data model, one dialog. That single decision drives the whole architecture: no duplicated "alarm" and "appointment" entities, no tabs, no permanent calendar grid cluttering the screen, no global toggle.

**Who it is for:** anyone who wants to *hear* what is due, not just read it — and, for reviewers, a compact example of how to build a strict-typed, fully tested web app that ships to iOS and Android from one codebase.

---

## Product at a glance

| Capability | What it does | Business value |
| --- | --- | --- |
| Unified list | Appointments and wake-up times are the **same** `CalendarEntry`; the calendar grid appears only when a date is picked | One mental model, zero context switching |
| Per-event chime | Bundled default / **local audio file (mp3, wav, m4a, aac, ogg, flac, webm)** / microphone recording, previewable before saving | Distinguishable alerts without looking at the screen |
| Own recording as native alarm sound | The raw `MediaRecorder` blob is handed **directly** to the WAV transcoder (no `data:`-URL round-trip) and written to `Library/Sounds` as real 16-bit PCM WAV; if transcoding fails, the bundled WAV is used and the form says so honestly | Your own voice rings the alarm, and a codec gap can never leave it silently muted |
| Click-to-edit | Tapping a row reopens the same dialog in edit mode | Fast correction, no duplicate records |
| Auto internal export | ICS text + readable summary regenerate on every change, no button, no confirmation | Always-current data for copy/paste or downstream sync |
| Standards export | `.ics` with `VALARM`, Google/Outlook reminder payloads | Portable into any existing calendar workflow |
| Native alarms | Local notifications rescheduled on every change | Rings even when the app is closed |
| Alarm window | In-app dialog with **Abbrechen** and **+15 Minuten**; native notification buttons bring the app to the foreground | Cancel without deleting the entry, or snooze by a real 15-minute move |
| Per-entry extra chime | A toggle gates whether the entry's own MP3/recording is used; options appear when enabled, a clear hint explains when no source is chosen yet, and re-enabling restores the last chosen sound. Editing an existing entry can record a fresh chime | One boolean per entry, persisted in localStorage **and** `.ics`, gating iOS notification sound, `Library/Sounds` and foreground playback |
| Stoppable alarm playback | The alarm dialog owns one shared, stoppable player; Cancel/Snooze/unmount silence a running chime | No sound keeps ringing after the window closes |
| Locked-device alarms | Native Local Notifications are time-sensitive, present on the Lock Screen and play the chime via the OS; permission is requested before any schedule; `localNotificationReceived` raises the in-app dialog when the app returns | Alarms fire even while the WebView is suspended |
| Period & holiday filters | Day / Week / Month / All plus "with / without public holidays" — **all** holidays: computed German nationwide ones (Easter-based included) **and imported ones** from subscribed EventKit/Google holiday calendars | Focus the list without touching the data |
| Past appointments | Optional toggle, **hidden by default** (time-of-day aware, not just date) | The list stays focused on what is still ahead |
| Next-event ticker | A progress bar shows the percentage of time elapsed toward the next appointment, driven by the existing 1-s clock | At-a-glance sense of "how close is it" |
| Persistent view | Initial view is **Day + without holidays + past hidden**; any change (period, holidays, past) is saved and restored on the next start | Clean first launch, no re-configuring afterwards |
| Current-time default | New entries start at the current local `HH:MM`; editing keeps the stored time. `DEFAULT_TIME` remains only for legacy-row migration | No manual time reset for "now" appointments |
| iOS polish | `UIApplicationSupportsShakeToEdit = false` suppresses the system Shake-to-Undo dialog over WKWebView text fields | No confusing OS prompt while holding the phone |
| Native calendar import | Existing EventKit events are merged at startup without duplicates | App opens with the calendar you already have |

**Design rules (deliberate):** one view, one source of truth, a form only when needed, and no global settings that actually belong to an individual record.

---

## Quick start

```bash
npm install
npm run dev          # http://127.0.0.1:5180/
npm run verify       # biome + typecheck + tests + build (single quality gate)
```

Scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `lint`, `lint:fix`, `verify`, `cap:sync`, `build:ios`, `build:android`, `deploy:device`, `go-live`.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Svelte 5 (runes) + Tailwind v4 | Minimal runtime, reactive by default |
| Language | TypeScript **strict** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) | Errors at compile time, not on device |
| Lint/format | Biome 2.5.7 | One tool, deterministic output |
| Tests | Vitest + Testing Library | 408 tests across 52 files |
| Build | Vite 6 | Fast web bundle (~120 kB JS / ~42 kB gzip; last verified 119.99 kB / 41.80 kB) |
| Mobile | Capacitor 8 (`ios/`, `android/`) | Same web build, native shell, no rewrite |

---

## Architecture

Pure logic lives in `src/lib/`; components render only. Two factories are the single source of truth — `lib/chime.ts` (`defaultChime()`) and `test/fixtures.ts` (`makeEntry()`) — so no scattered literals, and **production code never imports from `test/`**.

| Module | Responsibility |
| --- | --- |
| `enums.ts`, `types.ts`, `labels.ts`, `constants.ts` | Central types, enums, labels, limits |
| `time.ts`, `calendar.ts`, `alarm.ts`, `wecker.ts` | Date/time, month grid, minute comparison, status |
| `entries.ts`, `chime.ts`, `preferences.ts` | Persistence + migration, chime defaults, theme |
| `ical.ts`, `providers.ts`, `internal-sync.ts`, `bootstrap.ts` | ICS export/import, cloud adapters, auto-export, startup |
| `sound.ts`, `recording.ts`, `alarms-run.ts`, `notification-plan.ts`, `wav.ts`, `constants.ts` | Playback, audio-file validation, mic capture (returns the **raw Blob**), alarm firing, notification planning, **WAV transcoding** (RIFF/PCM 16-bit encoder + `normalizeOwnChime()`); `AUDIO_FILE_EXTENSIONS` / `AUDIO_FILE_ACCEPT` are the one source for the picker |
| `sound-file.ts`, `sound-file-native.ts` | Pure `soundWritePlan()` + `soundFilePort()` — **one** platform gate (`isNativeShell()`): native Filesystem writes to `Library/Sounds`, web gets a silent no-op |
| `calendar-port.ts`, `native-calendar-port.ts`, `calendar-import.ts` | Native calendar interface, EventKit adapter, duplicate-free startup merge |
| `alarm-actions.ts`, `alarm-bridge.ts`, `components/AlarmDialog.svelte` | Snooze/cancel logic, native action category, foreground alarm dialog |
| `ids.ts`, `platform.ts` | `randomUUID` fallback for insecure contexts, iOS detection |
| `native-shell.ts` | `isNativeShell()` — one shared check (`Capacitor.isNativePlatform()`/`getPlatform()` + `capacitor:` fallback) used by `App.svelte` and the notification port |
| `notification-port.ts` | `createNotificationPort(native)` takes the **already imported** `LocalNotifications` (one source, no second dynamic chunk); `rescheduleWith()` schedules first, `getPending()` cleanup is fire-and-forget |
| `list-filter.ts` | Pure period bounds + German holiday computation (Gaussian Easter) + `holidayLabelFor()` (one source for filter + badge) + `filterByPeriod()` (period / holidays / past) |
| `native-calendar-port.ts` | `isHolidayEvent()` marks imported holidays **synchronously at import time** (Google description / German holiday titles / all-day), plus best-effort `listCalendars()`. `mergeImportedEvents()` upgrades already-stored legacy rows; `normalizeEntry()` keeps the flag across reloads |
| `storage.ts` | **One** `StoragePort` (`@capacitor/preferences` native / `localStorage` web), injected once at startup; `initStorage()` migrates legacy keys and primes a synchronous cache so components stay sync. `migrateLegacyStorage()` never overwrites newer native values |
| `list-view.ts` | `loadListView()` / `saveListView()` — one source of truth for persisted filter selections |
| `next-event.ts` | `nextEvent()`, `previousAnchor()`, `progressToNext()` — pure, clamped 0..100 progress |

### Data model

`CalendarEntry`: `id`, `iso`, `time`, `title`, `category`, `note`, `chimeSource`, `chimeName`, `chimeDataUrl`, `externalId?`. Stored in `localStorage` (`clock.entries.v1`); legacy rows migrate on load (time → `09:00`, chime → default). `externalId` links an entry to its native EventKit event and survives reload and edit.

### Chime behaviour

- Three sources: bundled default, **any local audio file** picked via the native file browser (`<input type="file">`, ≤ 1.5 MB), and microphone recording (`MediaRecorder`). `isAcceptableAudioFile()` accepts mp3/wav/m4a/aac/ogg/flac/webm by extension or any `audio/*` MIME type; `normalizeOwnChime()` transcodes everything to a real WAV, so the picker does not need a native plugin. `pendingChime` makes Save await an in-flight conversion (no empty chime on a fast Save).
- Preview is a **toggle**: second click, close, save and unmount all stop playback (`createPreviewController`).
- **Native iOS sound:** `planNotifications()` sets `sound` on every scheduled notification. Capacitor/LocalNotifications emits **no sound on iOS** unless a bundled file is named explicitly — a JS ticker cannot ring while the app is closed. The bundled default is a short 8-second WAV derived from the bundled MP3, shipped in `public/` (git-tracked via a targeted `.gitignore` exception).
- **Own recordings / MP3s are transcoded to REAL WAV:** `MediaRecorder` produces `audio/webm` (iOS Safari: `audio/mp4`) and picked files are MP3 — but iOS `UNNotificationSound` only plays WAV/CAF/AIFF containers from `Library/Sounds`. `recordChime()` resolves with the **raw Blob**; `applyOwnChime()` in `AddEntryModal.svelte` is the single path for mic + file picker and hands that Blob straight to `normalizeOwnChime()`. `browserWavDeps().decode()` reads it via `Blob.arrayBuffer()` (FileReader fallback for older WebViews), so iOS `audio/mp4` reaches `decodeAudioData()` **unmodified** — the old `Blob → dataURL → Blob → atob` round-trip was the root cause of the silent-alarm bug and is gone. It mixes to mono and encodes RIFF/WAVE 16-bit PCM. On a genuine codec gap the entry keeps the raw clip for the in-app preview, but the form states honestly that the alarm will play the bundled default (no fake `*.wav` is written).
- **Own recordings on iOS:** a `data:` URL can never be a `UNNotificationSound`. For `ChimeSource.Recorded` / `ChimeSource.Custom`, `soundFileNameFor(id)` derives a stable `clock-chime-<hash>.wav` name; `soundWritePlan()` / `writeSoundFiles()` write the bare Base64 payload into `Library/Sounds` (`@capacitor/filesystem`, `Directory.Library`) **before** `port.reschedule()` runs. `notificationSoundFor()` then references that per-entry file; default entries keep the bundled WAV. `soundFilePort()` is the one platform gate: on the web it returns a silent no-op instead of a Filesystem proxy that would reject with `This browser doesn't support IndexedDB`. `removeSoundFile()` cleans up on delete. The Filesystem port is injected, so the logic is tested without a native bridge.
- The 1-s ticker fires each due id once per day. `claimAndFire()` claims ids **synchronously before** `await playChime`, so slow audio cannot cause a double ring. No `setTimeout` hacks.

### Alarm window & actions

- Every planned notification carries `actionTypeId: "CLOCK_ALARM"` and `extra.entryId`. `registerAlarmActions()` registers the **Abbrechen** / **+15 Minuten** category once at startup with `foreground: true`, so tapping a native button opens the app.
- In the foreground the 1-s ticker sets `activeAlarm` and renders `AlarmDialog.svelte` (testids `alarm-dialog`, `alarm-cancel`, `alarm-snooze`).
- **Abbrechen** closes the dialog and leaves the entry untouched (it does **not** delete the appointment). **+15 Minuten** calls `snoozedEntry()`, which moves `iso`/`time` by real `Date` arithmetic (rolls over midnight) and re-plans notifications. `applyPerformedAction()` maps the native event back to the same pure callback.
- Live-verified in the browser: dialog appears for a due entry, Cancel keeps the entry, Snooze moves 10:54 → 11:09, 0 JS errors.

### Export, import, startup

- `.ics`: VCALENDAR/VEVENT, UTC stamps, RFC-5545 escaping, **`VALARM` (`ACTION:DISPLAY`, `TRIGGER:-PT0M`)** per event. Audio itself cannot travel inside an `.ics` (no standard audio `ATTACH`); Google/Outlook payloads set `reminders` / `isReminderOn` instead.
- Internal export (`internalExportText` / `syncInternalExport`) regenerates automatically via `$effect` — no confirmation.
- **Native startup import:** `App.svelte` requests calendar permissions, calls `createCalendarPort().listEvents()` (EventKit range −1 year / +2 years), and merges with `mergeImportedEvents()`. Duplicates are detected by local `id` **or** `externalId` — **also inside the import itself**: EventKit returns one entry per occurrence of a recurring event, all sharing the same `eventIdentifier`, which otherwise produced duplicate keys in Svelte's keyed `{#each}` (`each_key_duplicate`, blank screen — found and fixed on a real iPhone 14 Pro). Local entries remain the source of truth (their chime, note and category are never overwritten). The manual `.ics` import uses the **same** merge function, so both import paths share one source of truth. `syncedToCalendar` is armed with the merged list so imported events are not written straight back to EventKit.
- **Honest limit:** a silent background import from Google/Mac/custom providers is impossible in a browser — OAuth requires a user gesture. Saved connections are surfaced as "sign in again"; buttons: Google, Mac, custom provider, `.ics` import.

### CalendarPort (design decision)

Inspired by [Integrating Calendar Events in a React Native App](https://dev.to/amitkumar13/integrating-calendar-events-in-a-react-native-app-5fgf): talk to **one** native calendar interface (`requestPermissions → listEvents → create → modify → delete`) instead of maintaining a path per vendor. Permissions are explicit, `create` returns a native `eventId`, and platform differences stay in an adapter, not the UI. The native implementation lives in `native-calendar-port.ts` behind `CalendarPort` (`@ebarooni/capacitor-calendar` / EventKit, registered via Swift Package Manager). `App.svelte` mirrors every change automatically: `syncToCalendar()` diffs the last synced snapshot against current entries, creates/modifies/deletes by `externalId`, and persists new native ids back into `localStorage`. The web build degrades to a no-op port. Cloud adapters are tested with mocked `fetch`; **a live Google/Outlook sync is not verified without OAuth tokens**, and the on-device EventKit permission dialog is a one-time user gesture (iOS 17+ keys are declared in `Info.plist`).

---

## Mobile (Capacitor)

**Decision: Capacitor.** The Svelte app is packaged as-is into a native shell — no rewrite, all TypeScript and all tests remain unchanged.

| | React Native | Tauri 2 | Capacitor |
| --- | --- | --- | --- |
| UI | real native components | WebView | WebView (WKWebView) |
| Mobile maturity | mature | v2 mobile still young | mature |
| This codebase | **full rewrite required** | reusable, but Rust/plugins | **100 % reusable** |
| Native notifications | third-party libs | Rust/Swift plugin | `@capacitor/local-notifications` |

React Native would be a new project; Tauri remains an option for desktop. Xcode is still required for iOS builds and signing.

### Alarm while the app is closed (the core problem)

A browser ticker only runs while the page is open. Therefore:

- `notification-plan.ts` purely computes future notifications (`id`, `title`, `body`, `at`, `sound`, `actionTypeId`, `entryId`).
- `notification-port.ts` exposes `requestPermission()` + `reschedule()`. Web = no-op; native = the **single** `LocalNotifications` object injected from `App.svelte`. `schedule()` runs first (it replaces same-id notifications), stale pending ids are cancelled fire-and-forget — a hanging `getPending()` can never block an alarm.
- `App.svelte` re-plans via `$effect` on **every** `entries` change (after writing own sound files).
- `alarm-bridge.ts` registers the Cancel/+15min action category; buttons are foreground actions.
- `Info.plist`: `NSMicrophoneUsageDescription`, `NSCalendarsUsageDescription`, `NSCalendarsFullAccessUsageDescription`, `NSCalendarsWriteOnlyAccessUsageDescription`, `UIBackgroundModes = audio`.
- Plugins registered by `cap sync`: `@capacitor/local-notifications`, `@ebarooni/capacitor-calendar`, `@capacitor/filesystem`.

### Build & deploy scripts

| Script | Purpose |
| --- | --- |
| `npm run cap:sync` | `build` + `cap sync` (both platforms) |
| `npm run build:ios` | `scripts/build-ios.sh` — verified simulator build; `DEVICE=1 DEVELOPMENT_TEAM=<TEAM>` builds for the connected hardware UDID |
| `npm run build:android` | `scripts/build-android.sh` — ready for later: checks `ANDROID_HOME`/`~/Library/Android/sdk`, builds web assets, `cap sync android`, Gradle `assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run deploy:device` | `scripts/deploy-device.sh` — installs over USB (`PLATFORM=ios\|android\|auto`, `LAUNCH=1` adds a readiness check) |
| `npm run go-live` | `scripts/go-live.sh` — one-shot: detect device UDID → signed build for that UDID → install → launch (needs `DEVELOPMENT_TEAM`) |

iOS uses `xcrun devicectl`, Android uses `adb install -r`. Both **verify a device is actually connected** and fail with a clear message instead of claiming success. `scripts/device.sh` is the single source of truth for physical-device discovery: a device-specific `-destination "platform=iOS,id=<UDID>"` is required so Xcode creates a provisioning profile that actually contains the target device (a generic destination reuses a cached portal profile with a stale UDID). `target_udids()` is that single selection point — `first_physical_udid()`, `device_destination()` and `deploy-device.sh` all consume it. When more than one device is connected, set `DEVICE_UDID=<UDID>` to target a specific one; otherwise the first USB device is used.

> **Device-support boundary (verified 2026-11-13):** Xcode 27/CoreDevice (Xcode 15+) talks only to **iOS 17+** devices. An iPad 8 on iPadOS 16.6 is visible and trusted to the legacy USB stack (`idevice_id`, `ideviceinfo`, `ios-deploy`) but appears in `devicectl` as `pairingState: unsupported` with no UDID, is absent from `xcodebuild -showdestinations`, and `xcodebuild -destination 'platform=iOS,id=<UDID>'` fails with "Unable to find a device matching the provided destination specifier". Enabling Developer Mode does **not** change this — it is a version-support limit, not a setting. Update the device to iPadOS 17+ (or use an older Xcode) before attempting a native install. The free Personal-Team profile is also device-locked (`ProvisionedDevices` lists only registered UDIDs), so a legacy `ios-deploy` install fails with `0xe8008015`.

```bash
# iOS on a connected iPhone (once Xcode is signed in with your Apple ID)
DEVICE=1 DEVELOPMENT_TEAM=<YOUR_TEAM_ID> npm run build:ios
PLATFORM=ios LAUNCH=1 npm run deploy:device

# One-shot: build for the connected UDID, install, launch
DEVELOPMENT_TEAM=<YOUR_TEAM_ID> npm run go-live

# Target a specific device (e.g. an iPad) when more than one is connected
DEVELOPMENT_TEAM=<YOUR_TEAM_ID> DEVICE_UDID=<IPAD_UDID> npm run go-live

# Android (after installing the Android SDK)
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run build:android
PLATFORM=android npm run deploy:device
```

**Environment requirements, stated honestly:** Xcode + iOS Simulator are present and `build:ios` passes. Android SDK / `adb` / `ANDROID_HOME` are **not** installed on this machine (Java 21 is), so `build:android` exits 1 with a clear install hint (verified). The script itself is complete and `bash -n` clean — it will work as-is once the SDK exists. **Still missing for exact Android alarms:** `SCHEDULE_EXACT_ALARM` (Android 12+) / `USE_EXACT_ALARM` (14+) in `AndroidManifest.xml` plus `checkExactNotificationSetting()` handling; without those Android triggers are inexact. A physical device requires Developer Mode enabled, a trusted USB pairing, and an Apple ID signed in to Xcode so a signing certificate and provisioning profile can be created (Personal Team works). **One-time on-device step:** after the first install, trust the developer certificate via *Settings → General → VPN & Device Management → Apple Development* — until then iOS refuses to launch the app with `profile has not been explicitly trusted by the user`. Without an account, `xcodebuild` correctly reports `No Accounts`, and `deploy:device` finds no signed `.app`.

---

## Quality gates

| Check | Result |
| --- | --- |
| `npm run lint` (Biome) | 0 errors, 0 warnings (113 files) |
| `npm run typecheck` (`tsc` + `svelte-check`) | 0 errors, 0 warnings |
| `npm run test` | **408 / 408 passing** (52 files) |
| `npm run build` | succeeds (119.99 kB JS / 41.80 kB gzip) |
| `hermes verify --json` | `ok: true` — bootstrap/build/typecheck/test/lint all EXIT 0, runtime boot ready (HTTP 200) |
| Local audio file browser | E2E test: picking a local `.m4a` stores a real `data:audio/wav;base64,...` chime; non-audio files are rejected with a clear error; 0 JS errors |
| `npm run cap:sync` | Capacitor plugins synced for iOS + Android; device log shows LocalNotifications, CapacitorCalendar, Preferences and Filesystem bridges |
| Native storage on device | `Preferences get`/`set` in the startup log, `PrivacyInfo.xcprivacy` bundled, 0 JS errors |
| `npm run build:ios` | `BUILD SUCCEEDED` on iPhone simulator and on the connected iPhone 14 Pro |
| Runtime boot | installed, launched, WKWebView loaded, 0 JS errors |
| `npm run go-live` | signed device build → USB install ✓. **Note:** a launch can fail with `Locked` when the iPhone auto-locks (`RequestDenied`); after unlocking, `--console --terminate-existing` and a plain relaunch both report `Launched` with all plugins and 0 JS errors |
| Live browser alarm test | dialog appears, Cancel keeps the entry, Snooze moves +15 min, 0 JS errors |
| Live browser feature test | extra-chime toggle hides/shows MP3/Aufnahme, flag persists, holiday badge + period/holiday filters work, 0 JS errors |
| Live browser view test | progress bar (50→51 %), past hidden by default, all 3 options survive a reload, 0 JS errors |
| Live browser holiday test | imported "Volkstrauertag" (`isHoliday`) gets a ★ badge and disappears from **list and ticker** under "Ohne Feiertage", 0 JS errors |
| Live browser initial/persistence test | fresh browser shows Day + Ohne Feiertage; changed selection (Woche + Mit Feiertagen) survives a reload, 0 JS errors |
| Live browser audio path | iOS `audio/mp4` bytes reach `decodeAudioData()` unchanged (`bytesMatch: true`), web `soundFilePort()` resolves all 3 calls silently, 0 JS errors |
| Alarm re-trigger (regression) | App-level test: the SAME alarm with an own recording plays again on a second trigger after Cancel, while 3 ticks in one minute still play only once; 0 JS errors |
| iOS `Library/Sounds` re-write | Device log exposed `OS-PLUG-FILE-0010 "already exists"` on every launch after the first; `stat()` now skips `mkdir` on an existing folder, a real `mkdir` failure still propagates, and `writeFile` runs. Device counter-check: `stat` 1×, `writeFile` 8×, 0 errors after 6 MP4→WAV migrations |

`npm run verify` runs the full chain in one command. Work is **not committed before live verification and sign-off**.

---

## Configuration & security

- `.env.sample` → `.env.local`: **public** OAuth client IDs only. Never put client secrets in the frontend; `.env*` is gitignored.
- Large/private media is gitignored: `public/README.md` + `scripts/setup-chime.sh` explain how to provide the bundled MP3 locally; the short notification WAV is the one deliberate exception.
- Generated iOS/Android artifacts, `dist/`, `node_modules/`, `*.mp3`, `*.apk`, `local.properties` and signing caches are excluded. No credentials, no personal data, no build output in the repository.

---

## Architecture decisions

| Area | Implementation |
| --- | --- |
| Persistence | `storage.ts` → `@capacitor/preferences` (`UserDefaults`/`SharedPreferences`), one-time legacy migration, `PrivacyInfo.xcprivacy` |
| Alarms | `@capacitor/local-notifications` with `presentationOptions`, `timeSensitive`, `foreground`; `getPending()` cleanup is fire-and-forget |
| Calendar | `@ebarooni/capacitor-calendar` via one `CalendarPort` (EventKit), duplicate-free import + write-back sync |
| Own audio | Native `<input type="file">` → `normalizeOwnChime()` → real WAV in `Library/Sounds`; no native audio plugin |

`timeSensitive` respects the iOS mute switch — a platform limit, not a bug.

---

## Roadmap / known limits

- End-to-end hardware test of a scheduled notification firing at its wake-up time with the app closed — especially with a **self-recorded** chime and the **Cancel/+15min** buttons. The `Library/Sounds` write path is verified on device (`writeFile` 8×, 0 errors).
- ~~Confirm on device that existing EventKit events appear after startup without duplicates.~~ **Verified on iPhone 14 Pro:** recurring EventKit series imported, no `each_key_duplicate`, app process running (PID 2481), 0 JS errors in syslog.
- Live Google/Outlook sync verification once OAuth client IDs exist.
- Android build verification once the SDK is installed.
- Startup import is currently one-way (EventKit → app); the write-back direction is handled by the change-sync effect, not a full bidirectional reconcile.

---

## License

MIT — see repository settings. Built as a portfolio reference for strict-typed, tested, cross-platform product engineering.
