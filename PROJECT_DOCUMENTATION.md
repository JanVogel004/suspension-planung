# SYSTEMDOKUMENTATION: Suspension Planung WebApp

> **Hinweis für zukünftige Entwickler & KIs / LLMs:**  
> Dieses Dokument beschreibt die gesamte Architektur, Datenstrukturen, Business-Logik, Abhängigkeiten und Eigenheiten der **Suspension Planung WebApp**. Es dient als vollständige Wissensbasis, damit jede KI oder jeder Entwickler ohne Vorwissen sofort an diesem Codebase weiterarbeiten, Fehler beheben und Features ergänzen kann.

---

## 1. Projektübersicht & Zweck

- **Projekt:** Suspension-Planung & Fertigungs-Tracking für ein Formula Student / Racing Team (CT Motorsport).
- **Technologie-Stack:** 
  - Frontend: Vanilla HTML5, Vanilla CSS3 (Custom Properties), Vanilla JavaScript (ES6+).
  - Backend / Datenbank: **Supabase REST API (PostgREST)** direkt aus dem Frontend per `fetch()`.
  - Externe Bibliotheken: Google Fonts (`Inter`), Font Awesome 6.4.0 (Icons via CDN). Keine Node-Build-Tools, kein Webpack/Vite notwendig.
- **Speicherort:** `c:\Users\vogel\OneDrive - mci4me.at\Dokumente\111_CTM\Suspension\WebApp_Planung\`
- **Git-Repository:** `https://github.com/JanVogel004/suspension-planung.git` (Branch: `main`)

---

## 2. Dateistruktur

```text
WebApp_Planung/
├── index.html               # Zentrale HTML-Datei (Modale, Nav, Tabs, Layout)
├── script.js                # Komplette Frontend-Logik (~2800 Zeilen)
├── style.css                # Gesamtes Styling & Theme (~870 Zeilen)
├── PROJECT_DOCUMENTATION.md # Diese Dokumentation
│
├── backup_tools/            # Alle Backup-Werkzeuge & Automatisierungsskripte
│   ├── auto_backup.ps1      # Automatisches Backup via PowerShell (Supabase REST -> JSON)
│   ├── auto_backup.py       # Automatisches Backup via Python
│   ├── run_backup.bat       # Starter für auto_backup.py
│   └── run_backup_silently.vbs # Silent VBScript-Wrapper (ohne Konsolenfenster)
│
├── backups/
│   └── auto/                # Automatisch abgelegte JSON-Backups (letzte 30 Tage)
│
├── .gitignore               # Ignoriert generierte Backup-JSONs & Caches
└── old_local/               # ARCHIV: Frühere lokale Flask/CSV-Version (nicht aktiv)
    ├── app.py
    ├── bauteile.csv
    ├── lieferanten.csv
    ├── normteile.csv
    └── Start_Suspension_Planung.bat
```

---

## 3. Backend & Datenbank (Supabase)

### 3.1 REST-Endpunkt
- **Base URL:** `https://dxxizztzvwnlwruxwmrw.supabase.co/rest/v1`
- **Authentifizierung:** `apikey` und `Authorization: Bearer <ANON_KEY>` (im Header über `getAuthHeaders()` in `script.js`).
- **Tabellen in Supabase:**
  1. `bauteile`: Enthält alle Fertigungsbauteile und Baugruppenzuordnungen.
  2. `lieferanten`: Lieferantendatenbank inkl. Fertigungsverfahren und Kooperation.
  3. `normteile`: Schrauben, Lager, Buchsen, Normkomponenten inkl. Lagerbestand.

### 3.2 Speicher- & Synchronisationsmuster (`saveData`)
- Aktuell arbeitet `saveData()` mit einem **Wipe-and-Replace-Muster**:
  1. `DELETE FROM {table}?id=not.is.null`
  2. `POST {table}` mit dem gesamten JSON-Array.
- **Sicherheitsstopp:** Falls `bauteileData.length === 0`, wird das Speichern blockiert, um versehentliches Löschen zu verhindern.
- Leere Strings bei Datum-Spalten werden vor dem Senden explizit auf `null` gemappt, um Supabase-Formatierungsfehler zu vermeiden.

---

## 4. Authentifizierung & Rollen

- **Mechanismus:** Clientseitige Session (`sessionStorage`).
- **Passwort:** `'suspension'`
- **Modi:**
  1. **Bearbeitungsmodus (`suspension_auth = 'true'`):** Voller Zugriff, Bearbeitung, Speichern möglich.
  2. **Nur-Lesen-Modus (`suspension_readonly = 'true'`):** 
     - Setzt CSS-Klasse `read-only` auf `<body>`.
     - Blendet alle Add-, Delete- und Speichern-Buttons per `display: none !important` aus.
     - Deaktiviert Formular-Inputs per `pointer-events: none`.
     - Der Tab **Lieferanten** ist im Nur-Lesen-Modus komplett gesperrt und ausgeblendet.

---

## 5. Datenmodelle & Schemata

### 5.1 Tabelle: `bauteile`
Ein Datensatz repräsentiert ein Bauteil. Standard-Spalten (`isStandardBCol`):
- `Bauteil-Name` (String, Primärer Name)
- `Baugruppe` (z. B. Wheel Assembly, Wishbones, Steering, Uprights)
- `Unterbaugruppe` (Sub-Baugruppe innerhalb der Baugruppe)
- `Unterbaugruppen-Status` (`Ausstehend`, `Im Lager`, `Assembled`, `Montiert`)
- `Fertiger / Firma` (Name des Partners / "Eigenfertigung")
- `Verantwortlich` (Teammitglied)
- `Dringlichkeit` (`Hoch`, `Mittel`, `Niedrig`)
- `Status` (Phasenstatus, siehe unten)
- `Assembly Zeit` (Tage, Zahl)
- `Montage Zeit` (Tage, Zahl)
- `Fertigungsdauer` (Tage, Zahl)
- `Kontrollzeit & Puffer` (Tage, Zahl)
- `Notizen` (Freitext / Langtext)
- `Benötigte Normteile` (JSON-String, siehe Kapitel 6)

#### Status-Werte (in logischer Reihenfolge):
1. `Nicht begonnen`
2. `Designing`
3. `Fertigungszeichnung`
4. `Kontrolle`
5. `Zu bestellen`
6. `In Fertigung`
7. `In Lieferung`
8. `Im Lager`
9. `Assembled`
10. `Fertig montiert`

### 5.2 Tabelle: `normteile`
Standard-Spalten (`isStandardNCol`):
- `Normteil Name` (z. B. "DIN 912 M6x25")
- `Kategorie` (z. B. "Schrauben", "Muttern", "Lager")
- `Beschreibung / Norm`
- `Shop Link`
- `Bestand` (Aktueller Lagerbestand, Zahl)
- `Geprüft am (Datum)`
- `Bestellte Stückzahl (Zahl)`
- `Bestellt am (Datum)`
- `Angekommen (Check)` (`true` / `false` / Checkbox)

### 5.3 Tabelle: `lieferanten`
Standard-Spalten (`isStandardLCol`):
- `Fertigungsverfahren` (z. B. 5-Achs-Fräsen, Drehen, Laserschneiden)
- `Firma (Fertiger)`
- `Zusammenarbeit` (Ampel: `""`, `Zufrieden`, `Können mehr machen`, `Wollen weniger machen`)
- `Typ` (`Sponsoren`, `Zulieferer`, `Mögliche Sponsoren`, `Sonstige`)
- `Teile / Komponenten (ct8)`
- `Email`
- `Webseite`
- `Notizen` / `Kontakt & Notizen`

### 5.4 Dynamische Spalten & Typ-Suffixe
Spalten können dynamisch hinzugefügt werden. Der Spaltentyp wird über Suffixe im Spaltennamen gesteuert:
- `(Datum)`, `date`, `deadline` -> HTML `<input type="date">`
- `(Zahl)`, `bestand` -> HTML `<input type="number">`
- `(Langtext)`, `notiz`, `beschreibung` -> `<textarea>` (Doppelklick öffnet Großeditor)
- `(Check)` -> Checkbox
- Bei der Tabellenanzeige wird das Suffix mit `displayCol(col)` für den Benutzer ausgeblendet.

---

## 6. Business-Logik & Berechnungen

### 6.1 "Benötigte Normteile" Verknüpfung
In `bauteile['Benötigte Normteile']` wird ein JSON-Array serialisiert gespeichert:
```json
[
  { "cat": "Schrauben", "name": "M6x25 DIN 912", "qty": 4 },
  { "cat": "Muttern", "name": "M6 Sicherungsmutter", "qty": 4 }
]
```
- In der **Normteile-Tabelle** ermittelt das Script dynamisch über alle Bauteile hinweg:
  - Wie viele Stück insgesamt im gesamten Fahrzeug benötigt werden (`totalQty`).
  - In welchen Bauteilen die Teile verbaut sind (inkl. Tooltip und Textsuche).
- **Normteile-Statuslogik:**
  - `ready` (Auf Vorrat): `totalQty <= Bestand` ODER `(totalQty <= Bestand + Bestellt && Angekommen)`
  - `ordered` (Bestellung unterwegs): `totalQty <= Bestand + Bestellt && !Angekommen`
  - `to_order` (Muss bestellt werden): `totalQty > Bestand + Bestellt`

### 6.2 Rückwärts- & Vorwärts-Terminberechnung (`calculateDates`)
Zwei Modi:
1. **Normalmodus (Rückwärtsrechnung vom globalen Zieltermin `targetDate` - Standard: 01.12.2026):**
   - $dTarget = \text{targetDate}$
   - $dLiefer = dTarget - (\text{Assembly Zeit} + \text{Montage Zeit})$
   - $dAbschick = dLiefer - \text{Fertigungsdauer}$
   - $dKontrolle = dAbschick - \text{Kontrollzeit \& Puffer}$
2. **Fixer Deadline-Modus (Vorwärtsrechnung):**
   - Falls ein Bauteil eine explizite Spalte (z. B. `Fixe Deadline` oder `Bestelldatum`) besitzt:
   - $dAbschick = \text{Eingegebenes Datum}$
   - $dLiefer = dAbschick + \text{Fertigungsdauer}$
   - $dTarget = dLiefer + \text{Assembly Zeit} + \text{Montage Zeit}$
   - $dKontrolle = dAbschick - \text{Kontrollzeit}$

### 6.3 Kritische Bauteile & Ampelsystem
- **Kritisch (Design):** Status in (`Nicht begonnen`, `Designing`, `Fertigungszeichnung`, `Kontrolle`) und Kontrolldatum liegt innerhalb der nächsten 4 Wochen (oder ist überfällig).
- **Überfällig:** $diffDays < 0$ (Rote Kennzeichnung).
- **Gefährdet:** $diffDays \le 7$ Tage (Gelbe Kennzeichnung).

---

## 7. Wichtige UI-Features & Modale

1. **Dashboard-Kacheln mit Direktsprung & Modalen:**
   - **Status Übersicht:** Klick auf einen Status (z. B. *Designing*) öffnet `#statusModal`, gruppiert Bauteile nach Baugruppe, bietet Direktsprung zum Teil oder Tabellenfilterung (`#status:...`).
   - **Normteile Übersicht:** Klick auf *Muss bestellt werden*, *Bestellung unterwegs* oder *Auf Vorrat* öffnet `#normteileStatusModal`, gruppiert nach Kategorie, zeigt Fehlmengen und Verbauungen.
2. **Such- & Filtersyntax:**
   - Planung: Freitext oder `#status:Designing`, `#status:Zu bestellen`, `#kritisch`
   - Normteile: Freitext oder `#to_order`, `#ordered`, `#ready`, `#missing`
3. **Gantt-Chart (`renderGanttChart`):**
   - Gruppiert nach Baugruppen mit Phasen: CAD (Lila), Kontrolle (Gelb), Fertigung (Blau), Assembly (Grün).
   - Enthält Linien für **Heute** (rot), **Design Freeze** (grün gestrichelt) und **Rolling Chassis Target** (grün gestrichelt).
   - Skalierung: Umschaltbar zwischen Wochen- und Monatsansicht.

---

## 8. Backup-System

- **Skripte:** `auto_backup.ps1` und `auto_backup.py`
- **Ablauf:**
  1. Ruft Supabase REST für `bauteile`, `normteile`, `lieferanten` ab.
  2. Speichert Zeitstempel-JSONs unter `backups/auto/{table}_backup_{timestamp}.json`.
  3. Löscht automatisch Backups, die älter als 30 Tage sind.
- Kann manuell per `run_backup.bat` oder im Hintergrund via Windows Task Scheduler mit `run_backup_silently.vbs` ausgeführt werden.

---

## 9. Bekannte Besonderheiten & Empfehlungen für Künftige Anpassungen

1. **`updateN` Funktion:**
   - In `renderNormteile` rufen `input`/`textarea`-Felder `updateN(index, col, value)` auf.
   - *Wichtig:* Sicherstellen, dass `window.updateN` parallel zu `updateB` und `updateL` stets existiert:
     ```javascript
     function updateN(index, key, value) {
         pushHistory();
         normteileData[index][key] = value;
         markDirty();
     }
     ```
2. **Undo-System (`historyStack`):**
   - `pushHistory()` speichert bis zu 30 Snapshots im Speicher.
   - Die Logik (`undo()`) ist vorhanden, ein dedizierter Undo-Button in der Navigationsleiste kann bei Bedarf eingebunden werden (`<button id="undoBtn" onclick="undo()">`).
3. **Save-Pattern (Destruktiv):**
   - Das aktuelle `DELETE` + `POST` reicht für Single-User-Nutzung völlig aus.
   - Falls mehrere Personen gleichzeitig editieren, sollte auf Supabase `UPSERT` via `id` umgestellt werden.
4. **Kein Framework / Bundler erforderlich:**
   - Änderungen können direkt in `index.html`, `script.js` oder `style.css` vorgenommen und per Git gepusht werden. Browser-Cache bei Tests via `?v=X` oder Strg+F5 umgehen.
