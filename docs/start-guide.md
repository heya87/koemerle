# App starten

Alle Befehle im Ordner `koemerle/app` ausführen.

---

## Normaler Start

```
npm run dev
```

Dann im Browser öffnen: [http://localhost:5173](http://localhost:5173)

---

## Datenbank neu aufsetzen (alles löschen und neu starten)

Nur nötig wenn etwas kaputt ist oder du von vorne beginnen willst:

```
npm run db:start
npm run db:clean
npm run dev
```

---

## Stoppen

Im Terminal `Ctrl+C` drücken.
Docker Desktop kann offen bleiben.
