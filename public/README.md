# Statische Assets

`chime-default.mp3` ist **absichtlich nicht im Repo** (15 MB, private Musikdatei,
urheberrechtlich geschuetzt, generiert/kopiert). Sie wird lokal bereitgestellt:

```bash
./scripts/setup-chime.sh "/pfad/zu/deiner.mp3"
```

Oder manuell:

```bash
cp "/pfad/zu/deiner.mp3" public/chime-default.mp3
```

Ohne die Datei funktioniert der Standard-Klingelton nicht — die App zeigt dann
einen Hinweis. Eigene MP3s pro Eintrag und YouTube-URLs brauchen diese Datei nicht.

Fuer ein Deployment kann stattdessen eine beliebige, frei lizenzierte MP3 unter
`public/chime-default.mp3` abgelegt werden.
