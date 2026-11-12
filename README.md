# Clock

> A single-list alarm & appointment app where **every event owns its own sound** — built as a production-grade, cross-platform reference project.

[![Stack](https://img.shields.io/badge/Svelte-5-ff3e00)](#tech-stack) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#tech-stack) [![Tests](https://img.shields.io/badge/tests-194%20passing-brightgreen)](#quality-gates) [![Platforms](https://img.shields.io/badge/Web%20%7C%20iOS%20%7C%20Android-blue)](#mobile-capacitor)

---

## The idea, in one paragraph

Most calendar apps treat the notification sound as a **global setting**. Clock flips that: a 7:00 workout, a 15:30 dentist appointment and a 24.12 family dinner can each ring differently — a bundled track, an MP3 from the device, a YouTube link, or a recording made with the microphone. One list, one data model, one dialog. That single decision drives the whole architecture: no duplicated "alarm" and "appointment" entities, no tabs, no permanent calendar grid cluttering the screen, no global toggle.

**Who it is for:** anyone who wants to *hear* what is due, not just read it — and, for reviewers, a compact example of how to build a strict-typed, fully tested web app that ships to iOS and Android from one codebase.

---

## Product at a glance

| Capability | What it does | Business value |
| --- | --- | --- |
| Unified list | Appointments and wake-up times are the **same** `CalendarEntry`; the calendar grid appears only when a date is picked | One mental model, zero context switching |
| Per-event chime | Default MP3 / own MP3 / YouTube / microphone recording, previewable before saving | Distinguishable alerts without looking at the screen |
| Click-to-edit | Tapping a row reopens the same dialog in edit mode | Fast correction, no duplicate records |
| Auto internal export | ICS text + readable summary regenerate on every change, no button, no confirmation | Always-current data for copy/paste or downstream sync |
| Standards export | `.ics` with `VALARM`, Google/Outlook reminder payloads | Portable into any existing calendar workflow |
| Native alarms | Local notifications rescheduled on every change | Rings even when the app is closed |

**Design rules (deliberate):** one view, one source of truth, a form only when needed, and no global settings that actually belong to an individual record.

---

## Quick start

```bash
npm install
npm run dev          # http://127.0.0.1:5180/
npm run verify       # biome + typecheck + tests + build (single quality gate)
```

Scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `lint`, `lint:fix`, `verify`, `cap:sync`, `build:ios`, `build:android`, `deploy:device`.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Svelte 5 (runes) + Tailwind v4 | Minimal runtime, reactive by default |
| Language | TypeScript **strict** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) | Errors at compile time, not on device |
| Lint/format | Biome 2.5.7 | One tool, deterministic output |
| Tests | Vitest + Testing Library | 194 tests across 26 files |
| Build | Vite 6 | Fast web bundle (~88 kB JS) |
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
| `sound.ts`, `youtube.ts`, `recording.ts`, `alarms-run.ts`, `notification-plan.ts`, `notification-port.ts` | Playback, URL validation, mic capture, alarm firing, scheduling |
| `ids.ts`, `platform.ts` | `randomUUID` fallback for insecure contexts, iOS detection |

### Data model

`CalendarEntry`: `id`, `iso`, `time`, `title`, `category`, `note`, `chimeSource`, `chimeName`, `chimeDataUrl`. Stored in `localStorage` (`clock.entries.v1`); legacy rows migrate on load (time → `09:00`, chime → default).

### Chime behaviour

- Four sources: bundled MP3, device MP3 (≤ 1.5 MB as data URL), validated YouTube URL (privacy-enhanced embed), microphone recording (`MediaRecorder`).
- Preview is a **toggle**: second click, close, save and unmount all stop playback (`createPreviewController`).
- The 1-s ticker fires each due id once per day. `claimAndFire()` claims ids **synchronously before** `await playChime`, so slow audio cannot cause a double ring. No `setTimeout` hacks.

### Export, import, startup

- `.ics`: VCALENDAR/VEVENT, UTC stamps, RFC-5545 escaping, **`VALARM` (`ACTION:DISPLAY`, `TRIGGER:-PT0M`)** per event. Audio itself cannot travel inside an `.ics` (no standard audio `ATTACH`); Google/Outlook payloads set `reminders` / `isReminderOn` instead.
- Internal export (`internalExportText` / `syncInternalExport`) regenerates automatically via `$effect` — no confirmation.
- `bootstrapCalendar()` loads all local entries and builds the internal snapshot in one step.
- **Honest limit:** a silent background import from Google/Mac/custom providers is impossible in a browser — OAuth requires a user gesture. Saved connections are surfaced as "sign in again"; buttons: Google, Mac, custom provider, `.ics` import.

### CalendarPort (design decision)

Inspired by [Integrating Calendar Events in a React Native App](https://dev.to/amitkumar13/integrating-calendar-events-in-a-react-native-app-5fgf): talk to **one** native calendar interface (`requestPermissions → findCalendars → fetchEvents → saveEvent → deleteEvent`) instead of maintaining a path per vendor. Permissions are explicit, `saveEvent` returns a native `eventId`, and platform differences stay in an adapter, not the UI. Today the web implementation (`ical.ts` + `providers.ts`) is that port; a native implementation will sit behind the same interface, storing `externalId` so edits/deletes hit the exact remote event. Cloud adapters are tested with mocked `fetch`; **a real live sync against Google/Outlook is not verified without OAuth tokens**.

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

- `notification-plan.ts` purely computes future notifications (`id`, `title`, `body`, `at`).
- `notification-port.ts` exposes `requestPermission()` + `reschedule()`. Web = no-op; native = `@capacitor/local-notifications`, **cancelling all pending first** so edits/deletes never leave stale alarms.
- `App.svelte` re-plans via `$effect` on **every** `entries` change.
- `Info.plist`: `NSMicrophoneUsageDescription`, `NSCalendarsUsageDescription`, `UIBackgroundModes = audio`.

### Build & deploy scripts

| Script | Purpose |
| --- | --- |
| `npm run cap:sync` | `build` + `cap sync` (both platforms) |
| `npm run build:ios` | `scripts/build-ios.sh` — verified simulator build; `DEVICE=1 DEVELOPMENT_TEAM=<TEAM>` for hardware |
| `npm run build:android` | `scripts/build-android.sh` — Gradle `assembleDebug` → `app-debug.apk` |
| `npm run deploy:device` | `scripts/deploy-device.sh` — installs over USB (`PLATFORM=ios|android|auto`, `LAUNCH=1` adds a readiness check) |
| `npm run go-live` | `scripts/go-live.sh` — one-shot: verify device → signed build → install → launch (needs `DEVELOPMENT_TEAM`) |

iOS uses `xcrun devicectl`, Android uses `adb install -r`. Both **verify a device is actually connected** and fail with a clear message instead of claiming success.

```bash
# iOS on a connected iPhone (once Xcode is signed in with your Apple ID)
DEVICE=1 DEVELOPMENT_TEAM=<YOUR_TEAM_ID> npm run build:ios
PLATFORM=ios LAUNCH=1 npm run deploy:device

# Android (after installing the Android SDK)
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run build:android
PLATFORM=android npm run deploy:device
```

**Environment requirements, stated honestly:** Xcode + iOS Simulator are present and `build:ios` passes. Android SDK / `adb` / `ANDROID_HOME` are **not** installed on this machine (Java 21 is), so `build:android` intentionally exits 1. A physical device requires Developer Mode enabled, a trusted USB pairing, and an Apple ID signed in to Xcode so a signing certificate and provisioning profile can be created (Personal Team works). Without an account, `xcodebuild` correctly reports `No Accounts`, and `deploy:device` finds no signed `.app`.

---

## Quality gates

| Check | Result |
| --- | --- |
| `npm run lint` (Biome) | 0 errors, 0 warnings |
| `npm run typecheck` (`tsc` + `svelte-check`) | 0 errors, 0 warnings |
| `npm run test` | **194 / 194 passing** (26 files) |
| `npm run build` | succeeds (~88 kB JS, ~29 kB CSS) |
| `npm run build:ios` | `BUILD SUCCEEDED` on iPhone simulator |
| Runtime boot | installed, launched, WKWebView loaded, 0 JS errors |

`npm run verify` runs the full chain in one command. Work is **not committed before live verification and sign-off**.

---

## Configuration & security

- `.env.sample` → `.env.local`: **public** OAuth client IDs only. Never put client secrets in the frontend; `.env*` is gitignored.
- Large/private media is gitignored: `public/README.md` + `scripts/setup-chime.sh` explain how to provide the bundled MP3 locally.
- Generated iOS/Android artifacts, `dist/`, `node_modules/`, `*.mp3`, `*.apk`, `local.properties` and signing caches are excluded. No credentials, no personal data, no build output in the repository.

---

## Roadmap / known limits

- Native `CalendarPort` implementation for device calendars and a real startup-wide import.
- Live Google/Outlook sync verification once OAuth client IDs exist.
- End-to-end hardware test of a scheduled notification firing at its wake-up time with the app closed.
- Android build verification once the SDK is installed.

---

## License

MIT — see repository settings. Built as a portfolio reference for strict-typed, tested, cross-platform product engineering.
