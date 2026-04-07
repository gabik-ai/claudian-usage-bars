# Claudian Usage Bars

Live Claude Max usage bars in the Claudian header — zeigt 5h, 7d und Sonnet-Limits in Echtzeit.

![preview](https://img.shields.io/badge/Obsidian-Plugin-purple)

## Voraussetzungen

- [Claudian](https://github.com/gabrielsimkin/claudian) muss installiert und aktiv sein
- Claude Code muss auf dem Mac installiert sein (das Plugin liest den lokalen Token aus dem macOS Keychain)
- macOS only

## Installation via BRAT

1. BRAT installieren: Obsidian → Einstellungen → Community-Plugins → `BRAT` suchen + installieren
2. BRAT öffnen → **"Add Beta Plugin"**
3. Diese URL einfügen:

```
https://github.com/gabrielsimkin/claudian-usage-bars
```

4. **"Add Plugin"** klicken
5. Einstellungen → Community-Plugins → **"Claudian Usage Bars"** aktivieren

Die Usage-Bars erscheinen automatisch im Claudian-Header.

## Was wird angezeigt

| Bar | Bedeutung |
|-----|-----------|
| **5h** | Nutzung der letzten 5 Stunden |
| **7d** | Gesamtnutzung der letzten 7 Tage |
| **Sonnet** | Sonnet-spezifisches 7d-Limit |

Hover über die Bars zeigt die genaue Reset-Zeit.

## Farben

- 🟢 Grün: unter 50%
- 🟡 Gelb: 50–80%
- 🔴 Rot: über 80%

## Autor

Von Claudian für Gabriel Simkin — [Mazel Mail](https://mazelmail.de)
