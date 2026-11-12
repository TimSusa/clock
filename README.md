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

Im Anlege-/Edit-Dialog: **Standard** (bundled `public/chime-default.mp3`), **eigene MP3 vom Geraet** (max. 1,5 MB, als Data-URL im Eintrag) oder **YouTube-URL** (validiert, Vorschau als `youtube-nocookie.com` Embed). „Anhoeren" ist ein Toggle: erneuter Klick, Schliessen, Speichern und Unmount stoppen die Wiedergabe (`createPreviewController` in `sound.ts`).

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

## Mobile: React Native vs. Tauri

| | React Native | Tauri 2 |
| --- | --- | --- |
| UI | echte native Komponenten (Fabric/JSI) | WebView (WKWebView / Android System WebView) |
| Mobile-Reife | ausgereift, jahrelang in Produktion | v2-mobil noch jung/beta-artig, Desktop stabil |
| Unsere Svelte-App | **muesste neu geschrieben werden** | **bleibt unverändert**, nur eine Huelle drum |
| Native Kalender/Notifications | `react-native-calendar-events`, `@notifee/...` direkt | Plugins (Rust + Swift/Kotlin) noetig |
| Bundle | groesser | sehr klein (OS-Webview) |

**Empfehlung fuer dieses Projekt: Tauri 2.** Der gesamte bestehende Code (Svelte 5, striktes TS, 171 Tests) bleibt zu 100 % erhalten — RN wuerde einen kompletten Rewrite bedeuten. Tauri liefert zudem Desktop (macOS/Windows/Linux) gratis mit. Der Preis: mobile Reife und dass native Features (lokale Notifications, Geraetekalender ueber den `CalendarPort`) als Plugins in Rust/Swift/Kotlin gebaut werden muessen. Wer mobile **native UI** und maximale Plattform-Stabilitaet priorisiert, nimmt RN — aber dann ist es ein neues Projekt, nicht dieses Repo.

Alternativ, falls nur iOS/Android ohne Desktop gebraucht wird: **Capacitor** ist der kleinste Schritt (dieselbe Web-App + `@capacitor/local-notifications` + `@capacitor/calendar`-aehnliche Plugins), mit ausgereifterer Mobile-Story als Tauri.

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
