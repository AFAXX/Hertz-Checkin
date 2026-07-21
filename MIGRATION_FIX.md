# 🔧 FixErrore "archivedAt does not exist" + Auto-Archive + Gallery Archivio

Questo documento spiega come:
1. Risolvere l'errore `The column 'RentalContract.archivedAt' does not exist in the current database`
2. Configurare l'auto-archive alle 04:00 AM
3. Usare la nuova vista Archivio con galleria foto cliccabile

---

## ⚠️ Problema 1 — Errore upload Excel / creazione contratto

### Causa
Lo schema Prisma (`prisma/schema.prisma`) definisce la colonna `archivedAt` sul modello `RentalContract`, ma il database PostgreSQL di produzione su Neon **non ha la colonna**. La migration `20260721_add_geo_and_auth` non è mai stata applicata al database di produzione.

Quando l'applicazione chiama `prisma.rentalContract.findUnique()` o `findMany()`, il client Prisma (generato con il nuovo schema) cerca di SELECT-are la colonna `archivedAt` che non esiste → **Prisma solleva un errore** e l'operazione fallisce.

### Soluzione — SCEGLI UNA DELLE DUE OPZIONI

#### Opzione A (consigliata) — Applica la migration con Prisma CLI

Dal terminale locale, nella cartella del progetto:

```bash
# 1. Assicurati di avere DATABASE_URL di produzione in .env.local o come env var
export DATABASE_URL="postgresql://user:password@ep-xxx.eu-west-2.aws.neon.tech/dbname?sslmode=require"

# 2. Installa le dipendenze se non già fatto
npm install

# 3. Genera il client Prisma
npx prisma generate

# 4. Applica le migration pendenti al database di produzione
npx prisma migrate deploy

# 5. Verifica lo stato
npx prisma migrate status
```

Output atteso:
```
Applying migration `20260721_add_geo_and_auth`

🚀  Apply complete
```

#### Opzione B — Applica SQL direttamente nel Neon SQL Editor

Se non hai Prisma CLI configurato o `migrate deploy` non funziona:

1. Vai su https://console.neon.tech → tuo progetto → **SQL Editor**
2. Apri il file `scripts/apply-migration.sql` di questo repo
3. Copia tutto il contenuto e incollalo nel SQL Editor
4. Clicca **Run**
5. Verifica con la query di verifica in fondo allo stesso script

Lo script è **idempotente** — può essere eseguito più volte senza problemi.

### Verifica che il fix abbia funzionato

Dopo aver applicato la migration:

1. Ridistribuisci l'app su Vercel (anche solo un redeploy del commit esistente)
2. Vai su `https://hertz-checkin.vercel.app`
3. Prova a caricare un file Excel o creare un nuovo contratto
4. NON dovrebbe più apparire l'errore `archivedAt does not exist`

Se vedi ancora l'errore, controlla che `DATABASE_URL` su Vercel (Project Settings → Environment Variables) punti allo stesso database Neon a cui hai applicato la migration.

---

## ⏰ Funzionalità 2 — Auto-archive automatico alle 04:00 AM

### Come funziona

- Ogni giorno alle ore 02:00 UTC e 03:00 UTC (copre CET e CEST → 04:00 Malta), Vercel Cron chiama `GET /api/admin/cron/auto-archive`
- L'endpoint archivia **tutti** i contratti attivi (pending / in_progress / completed) con `createdAt < oggi_04:00_Malta`
- La funzione è **idempotente** — può girare più volte al giorno senza duplicare nulla
- Come backup, l'auto-archive gira anche ogni volta che l'admin apre la dashboard

### Setup

1. **Genera un CRON_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

2. **Aggiungi la variabile su Vercel**:
   - Vai su Project Settings → Environment Variables
   - Key: `CRON_SECRET`
   - Value: il valore generato sopra
   - Ambiente: Production (e anche Preview se vuoi testare)

3. **Verifica che `vercel.json` sia stato deployato**:
   - Dopo il deploy, vai su Vercel Dashboard → tuo progetto → **Cron Jobs**
   - Dovresti vedere due job: uno a `0 2 * * *` e uno a `0 3 * * *`

4. **Test manuale** (opzionale):
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
        https://hertz-checkin.vercel.app/api/admin/cron/auto-archive
   ```
   Output atteso: `{"success":true,"timestamp":"...","archived":N,"skipped":null}`

### Note importanti

- Su **Vercel Hobby (free)** il limite è 2 cron jobs — ne abbiamo usati 2
- I contratti creati dopo le 04:00 AM restano attivi fino alle 04:00 AM del giorno successivo
- I contratti creati prima delle 04:00 AM vengono archiviati allo scoccare delle 04:00 AM
- La logica usa il fuso orario `Europe/Malta` (CET/CEST auto-gestito)

---

## 🖼️ Funzionalità 3 — Vista Archivio + Galleria Foto cliccabile

### Come usarla

1. Apri la dashboard admin
2. Sopra la tabella contratti trovi due bottoni toggle: **Active** | **Archive**
3. Clicca **Archive** per vedere i contratti archiviati
4. I contratti con `status=completed` e `photosSubmitted > 0` sono:
   - Evidenziati con icona 📸 accanto al numero contratto
   - **Cliccabili** sulla riga intera → apre la galleria foto
   - Hanno anche un bottone blu **"View Photos"** nella colonna Actions
5. La galleria mostra:
   - Tutte le foto del contratto in una griglia responsive
   - Anteprima immagine (se disponibile via SharePoint URL o API locale)
   - Nome file, dimensione, requisito (front/back/driver_side/ecc.)
   - Data/ora di acquisizione (`capturedAt`)
   - Link "Apri in Google Maps" se la foto ha coordinate GPS

### Comportamento

- Solo i contratti **archiviati** AND **completati** AND **con almeno 1 foto** sono cliccabili
- I contratti archiviati ma non completati (pending/in_progress) NON sono cliccabili (non hanno foto utili)
- La galleria si chiude cliccando fuori, sul bottone "Chiudi", o sulla X in alto a destra

---

## 📋 Checklist deploy

- [ ] Applicata la migration `20260721_add_geo_and_auth` al database Neon
- [ ] Verificato che l'upload Excel funzioni senza errori
- [ ] Verificato che la creazione di un nuovo contratto funzioni
- [ ] Generato e impostato `CRON_SECRET` su Vercel
- [ ] Verificata la presenza dei 2 cron jobs nella Vercel dashboard
- [ ] Testato il trigger manuale: `curl -H "Authorization: Bearer ..." https://.../api/admin/cron/auto-archive`
- [ ] Aperta la vista Archivio e verificato che i contratti archiviati siano visibili
- [ ] Verificato che cliccando un contratto archiviato completato con foto si apra la galleria

---

## 🆘 Troubleshooting

### L'errore "archivedAt does not exist" persiste dopo aver applicato la migration

1. Verifica con query SQL diretta su Neon:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'RentalContract' AND column_name = 'archivedAt';
   ```
   Deve restituire 1 riga.

2. Verifica che `DATABASE_URL` su Vercel punti allo stesso database:
   - Su Neon: copia la connection string dal progetto
   - Su Vercel: confrontala con quella impostata

3. Fai un redeploy esplicito su Vercel (Projects → Redeploy)

### Il cron job non gira

- Vercel Hobby limita i cron jobs. Verifica di averli nella dashboard
- Il cron job richiede `CRON_SECRET` impostato come env var su Vercel
- Controlla i logs del cron job in Vercel → Functions → cron-auto-archive

### La galleria foto non mostra le immagini

- Le foto vengono caricate da `/api/photos/<id>` (storage locale) o da URL SharePoint
- Se `localPath` è vuoto o non raggiungibile, viene mostrato "No preview available"
- Verifica che la cartella di storage locale sia accessibile dall'app
- Per SharePoint: verifica che `GRAPH_*` env vars siano impostati correttamente
