# Clock

Wecker- und Termin-App. Svelte 5 + Tailwind v4, striktes TypeScript, Biome, Vitest.

## Start

```bash
npm install
npm run dev            # http://127.0.0.1:5180/
npm run verify         # biome + typecheck + tests + build
```

Weitere Skripte: `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run lint`, `npm run lint:fix`, `npm run build`, `npm run preview`.

## Eine Ansicht, ein Datensatz

Es gibt **keine Tabs**. Die Home-View zeigt eine einzige Liste „Alle Eintraege" (Termine und Weckzeiten sind identisch), den **+ Button im Kopf der Liste** und die Synchronisierung darunter. Das Monatskalender-Raster erscheint **nur bei Bedarf** im Anlege-Dialog („Datum im Kalender waehlen"). Klick auf eine Zeile bearbeitet den Eintrag im selben Dialog.

`CalendarEntry` (`src/lib/types.ts`) traegt `id`, `iso`, `time`, `title`, `category`, `note` sowie den Klingelton (`chimeSource`, `chimeName`, `chimeDataUrl`). Persistiert in `localStorage` (`clock.entries.v1`); alte Datensaetze werden beim Laden migriert (Zeit → `09:00`, Klingelton → Standard).

## Klingelton pro Eintrag

Im Anlege-/Edit-Dialog: **Standard** (bundled `public/chime-default.mp3`), **eigene MP3 vom Geraet** (max. 1,5 MB, als Data-URL im Eintrag), **YouTube-URL** (validiert, Vorschau als `youtube-nocookie.com` Embed) oder **Mikrofon-Aufnahme** (`MediaRecorder`, `ChimeSource.Recorded`, lokal als Data-URL gespeichert, `NSMicrophoneUsageDescription` auf iOS). „Anhoeren" ist ein Toggle: erneuter Klick, Schliessen, Speichern und Unmount stoppen die Wiedergabe (`createPreviewController` in `sound.ts`).

Einen **globalen** Klingelton-Schalter gibt es bewusst nicht — der Ton gehoert zum einzelnen Eintrag.

Zur Terminzeit spielt der 1-s-Ticker den jeweiligen Ton ab (`alarms-run.ts` → `pendingAlarms`, einmal pro ID und Tag, Autoplay-Blockaden werden geschluckt). Keine `setTimeout`-Hacks.

> **Ehrliche Grenze:** Solange die App geschlossen ist, kann ein Browser nicht klingeln. Dafuer braucht es native lokale Notifications (siehe „Mobile").

## Export, Import und Startup

- **.ics-Export**: VCALENDAR/VEVENT mit UTC-Zeitstempeln, RFC-5545-Escaping und **`VALARM` (`ACTION:DISPLAY`, `TRIGGER:-PT0M`)** pro Event — der Zielkalender erinnert zur Terminzeit. Der Ton selbst kann in einer `.ics` nicht mitwandern (RFC 5545 / gaengige Clients koennen kein Audio-`ATTACH`); Google/Outlook-Payloads setzen dafuer `reminders` bzw. `isReminderOn`.
- **Interner Export ohne Datei**: `internalExportText()` / `syncInternalExport()` erzeugen ICS-Text + lesbare Zusammenfassung. Ein `$effect` aktualisiert den Snapshot **automatisch bei jeder Aenderung** — kein Button, keine Bestätigung. „Kopieren" legt das ICS ins Clipboard.
- **Startup**: `bootstrapCalendar()` importiert alle vorhandenen lokalen Eintraege und baut den internen Export in einem Schritt.
- **Fremde Kalender**: Ein vollautomatischer Silent-Import beim Startup ist im Browser **technisch nicht moeglich** — OAuth verlangt zwingend eine User-Geste. Gespeicherte Verbindungen werden daher als „bitte erneut anmelden" angezeigt; Buttons: **Bei Google anmelden**, **Bei Mac anmelden**, **Custom-Anbieter waehlen**, plus `.ics`-Dateiimport.

## Architektur-Entscheidung: ein CalendarPort statt vieler Adapter

Inspiriert von [„Integrating Calendar Events in a React Native App"](https://dev.to/amitkumar13/integrating-calendar-events-in-a-react-native-app-5fgf) (`react-native-calendar-events`):

Die relevante Erkenntnis ist **nicht** die Library, sondern das Muster: eine App redet mit **einem** nativen Kalender-Interface — `requestPermissions()` → `findCalendars()` → `saveEvent()` → `findEventById()` — statt fuer jeden Anbieter einen eigenen Pfad zu pflegen. Permissions sind ein expliziter Schritt (iOS `NSCalendarsUsageDescription`, Android Runtime-Request), `saveEvent` liefert eine **native eventId** zurueck, und iOS/Android-Unterschiede gehoeren in eine Adapter-Schicht, nicht in die UI. Der Autor bestaetigt zudem: das funktioniert nur fuer **lokale Geraetekalender**, nicht direkt fuer Google-Konten.

Fuer Clock bedeutet das: `CalendarPort` mit `requestPermission / listCalendars / fetchEvents / saveEvent / deleteEvent`. Die heutige Web-Implementierung (`ical.ts` + `providers.ts`) ist ein Port; die spaetere Native-Implementierung ein zweiter hinter demselben Interface. `fetchEvents()` macht den Startup-Import dann wirklich „alle Kalender", und die native `eventId` wird als `externalId` am Eintrag gespeichert, damit Update/Delete exakt das richtige Event treffen. Bis dahin bleiben Cloud-Adapter mit gemocktem `fetch` getestet; **ein echter Live-Sync gegen Google/Outlook ist ohne OAuth-Tokens nicht verifiziert**.

## Mobile: Capacitor (iOS + Android)

**Entscheidung: Capacitor.** Die App ist eine Svelte-5-Web-App; Capacitor packt genau diesen Build (`dist/`) in eine native Huelle — **kein Rewrite**, der gesamte TS-Code und alle Tests bleiben unveraendert.

| | React Native | Tauri 2 | Capacitor |
| --- | --- | --- | --- |
| UI | echte native Komponenten | WebView | WebView (WKWebView) |
| Mobile-Reife | ausgereift | v2-mobil noch jung | ausgereift |
| unsere App | **Komplett-Rewrite noetig** | bleibt, aber Rust/Plugins | **bleibt zu 100 %** |
| Native Notifications | ueber Libraries | Rust/Swift-Plugin | `@capacitor/local-notifications` |

RN scheidet aus (waere ein neues Projekt), Tauri bleibt eine Option fuer Desktop, ist aber fuer iOS/Android noch nicht die stabilste Wahl. Xcode wird fuer iOS-Build/Signing weiter benoetigt.

### Build- & Deploy-Scripts

| Script | Was es tut |
| --- | --- |
| `npm run cap:sync` | `build` + `cap sync` (beide Plattformen) |
| `npm run build:ios` | `scripts/build-ios.sh` — Simulator-Build (verifiziert). Mit `DEVICE=1 DEVELOPMENT_TEAM=<TEAM>` Device-Build |
| `npm run build:android` | `scripts/build-android.sh` — Gradle `assembleDebug` → `app-debug.apk` |
| `npm run deploy:device` | `scripts/deploy-device.sh` — spielt den Build per USB auf angeschlossene Geraete (`PLATFORM=ios|android|auto`) |

iOS-Deploy nutzt `xcrun devicectl`, Android-Deploy `adb install -r`. Beide **pruefen vorher**, ob wirklich ein Geraet verbunden ist, und brechen mit einer klaren Meldung ab statt Erfolg zu behaupten.

> **Ehrliche Voraussetzungen:** Xcode 27.1 + iOS-Simulator sind vorhanden und `build:ios` laeuft durch. Fuer **Android** fehlen auf diesem Rechner das Android SDK, `adb` und `ANDROID_HOME` (nur Java 21 ist da) — `build:android` bricht deshalb bewusst mit Exit 1 ab. **Kein physisches Geraet** ist per USB angeschlossen (`xcrun devicectl` listet nur Simulatoren), daher kann `deploy:device` aktuell nichts installieren. Sobald SDK bzw. Geraet vorhanden sind, laufen die Scripte ohne weitere Aenderung.

```bash
# iOS auf angeschlossenes iPhone:
DEVICE=1 DEVELOPMENT_TEAM=ABCDE12345 npm run build:ios
PLATFORM=ios npm run deploy:device

# Android (nach SDK-Installation):
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run build:android
PLATFORM=android npm run deploy:device
```

Fuer ein **physisches Geraet** braucht es zusaetzlich ein Apple Developer Team (`DEVELOPMENT_TEAM`) und ein angeschlossenes, vertrautes iPhone — automatische Installation auf Hardware ist ohne Signing nicht moeglich.

### Wecker bei geschlossener App (der eigentliche Kern)

Der Browser-Ticker klingelt nur bei offener App. Deshalb:

- `notification-plan.ts` berechnet **rein** die zukuenftigen Eintraege (`id`, `title`, `body`, `at`).
- `notification-port.ts` ist der `NotificationPort`: `requestPermission()` + `reschedule()`. Auf dem Web ein No-Op (dort uebernimmt der Ticker), nativ `@capacitor/local-notifications` — vorher **cancel aller pending**, dann neu planen. So hinterlaesst Editieren/Loeschen keine veralteten Alarme.
- `App.svelte` stoesst `reschedule` per `$effect` bei **jeder** Aenderung von `entries` an.
- `claimAndFire()` beansprucht due IDs **synchron vor** dem `await playChime`, damit der 1-s-Ticker bei langsamem Audio nicht mehrfach klingelt.

`Info.plist` enthaelt `NSMicrophoneUsageDescription`, `NSCalendarsUsageDescription` und `UIBackgroundModes = audio`.

## Architektur

Reine Logik in `src/lib/`, UI rendert nur. Zentrale Quellen: `lib/chime.ts` (`defaultChime()`) und `test/fixtures.ts` (`makeEntry()`) — keine verstreuten Literale, Produktionscode importiert nie aus `test/`.

| Modul | Aufgabe |
| --- | --- |
| `enums.ts`, `types.ts`, `labels.ts`, `constants.ts` | zentrale Konstanten/Typen |
| `time.ts`, `calendar.ts`, `alarm.ts`, `wecker.ts` | Datum/Zeit, Raster, Alarm-Minutenvergleich, Status |
| `entries.ts`, `chime.ts`, `preferences.ts` | Persistenz + Migration, Klingelton-Defaults, Theme |
| `ical.ts`, `providers.ts`, `internal-sync.ts`, `bootstrap.ts` | Export/Import, Cloud-Adapter, Auto-Export, Startup |
| `sound.ts`, `youtube.ts`, `alarms-run.ts`, `preview.test.ts` | Wiedergabe, URL-Validierung, Alarm-Ausloesung |
| `ids.ts`, `platform.ts` | `randomUUID`-Fallback fuer unsichere Kontexte, iOS-Erkennung |

## Konfiguration

`.env.sample` → `.env.local` (nur **public** OAuth-Client-IDs; **niemals** Client-Secrets ins Frontend). `.env*` ist in `.gitignore`.
