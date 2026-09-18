# Sigurnosna kopija — da ništa ne propadne

Platforma živi na tri mjesta i svako se čuva na svoj način:

| Šta | Gdje je sada | Kako se čuva |
|---|---|---|
| **Kod** (sve što programeri pišu) | GitHub, grana `main` | već je sigurno; povremeno spasi i ZIP na svoj računar |
| **Sadržaj** (lekcije, kvizovi, učenici, hasanati, vježbe) | samo u bazi na serveru | **Admin panel → Sigurnosna kopija → Preuzmi kopiju sadržaja** |
| **Fajlovi** (PDF, slike, audio, H5P) | disk servera, `/data/mekteb-uploads` (u kontejneru `/app/uploads`) | **Admin panel → Sigurnosna kopija → Preuzmi sve fajlove** |

Kod je jedini koji se sam čuva. Sadržaj i fajlovi postoje **samo na serveru** dok
ih neko ne prekopira negdje drugdje.

## Sedmični ritual (pet minuta)

1. Otvori **Admin panel → Sigurnosna kopija** i klikni **Preuzmi kopiju sadržaja**.
   Dobiješ jednu datoteku, npr. `mekteb-sadrzaj-2026-09-18-1830.ndjson.gz`.
2. Spasi je u folder na svom računaru (npr. `Mekteb kopije`) **i** u oblak
   (Google Drive, OneDrive — bilo šta što nije server).
3. Čuvaj zadnje četiri kopije; starije slobodno briši.

Drugo dugme, **Preuzmi sve fajlove**, daje `mekteb-fajlovi-<datum>.tar.gz` sa
svim priloženim PDF-ovima, slikama, audiom i H5P-om. Ono je mnogo veće i mijenja
se rjeđe, pa je dovoljno jednom mjesečno i poslije većeg dodavanja materijala.
Arhivu otvara i macOS i Windows 11 dvoklikom, bez dodatnog programa.

Pravilo je jednostavno: kopija na serveru ne vrijedi ništa kad server nestane.
Neka bar jedna kopija uvijek bude negdje drugdje.

## Jednom namjestiti u Coolifyju

1. **Automatska kopija baze.** Coolify → resurs baze (PostgreSQL) → *Backups* →
   uključi dnevnu kopiju i, ako imaš, upiši S3 (Backblaze B2, Wasabi, Hetzner).
   Bez S3 kopija ostaje na istom serveru — bolje nego ništa, ali nije dovoljno.
2. **Trajni folder za fajlove — provjereno 18.09.2026, uredu je.**
   Coolify → aplikacija → *Storages* → *Volumes*: `/app/uploads` je vezan na
   `/data/mekteb-uploads` na serveru, a `/app/edu` na folder aplikacije. Znači
   redeploy ne briše okačene fajlove. Ako se ovo ikad promijeni, novi fajlovi
   bi nestajali pri svakom deployu — zato pogledaj ovdje ako slike nestanu.

## Sve sa servera jednom komandom

Coolify → Terminal (ili cron na serveru):

```bash
DATABASE_URL="postgres://..." UPLOADS_DIR=/app/uploads \
  ./scripts/sigurnosna-kopija.sh /kopije
```

Napravi dvije datoteke u `/kopije` i obriše kopije starije od 14 dana:

- `mekteb-baza-<datum>.dump` — cijela baza (`pg_dump`, vraća se sa `pg_restore`)
- `mekteb-fajlovi-<datum>.tar.gz` — svi priloženi fajlovi

Datoteke obavezno prebaci sa servera (`scp`, rsync, S3…).

## Kako se kopija vraća

**Baza u cjelini** (kopija iz Coolifyja ili `pg_dump`):

```bash
pg_restore --clean --no-owner --dbname "postgres://..." mekteb-baza-<datum>.dump
```

**Samo sadržaj** (datoteka preuzeta iz admin panela, u bazu koja već ima tabele):

```bash
# prvo proba — ništa se ne upisuje, samo ispiše šta bi uradio
pnpm --filter @workspace/scripts vrati-sadrzaj -- --fajl=mekteb-sadrzaj-<datum>.ndjson.gz

# pa stvarno vraćanje (briše zatečeni sadržaj tabela iz kopije!)
pnpm --filter @workspace/scripts vrati-sadrzaj -- --fajl=mekteb-sadrzaj-<datum>.ndjson.gz --potvrdi
```

Vraćanje ide u jednoj transakciji: ili prođe sve, ili se ništa ne promijeni.
Brojači ID-eva se poslije podese sami, pa novi unosi ne udaraju u stare.

**Fajlovi** (arhiva iz admin panela ili sa servera):

```bash
tar -xzf mekteb-fajlovi-<datum>.tar.gz -C /data/mekteb-uploads
```

## Šta pokriva sam server

Hetzner Cloud backup (uključen 18.09.2026) slika **cijeli server** jednom
dnevno i drži **sedam kopija** — kad napravi osmu, briše najstariju. To pokriva
kvar servera: baza, fajlovi, Coolify i sve ostalo vrate se na stanje od jučer.

Ne pokriva dvije stvari, i zato kopije kod sebe i dalje vrijede:

- grešku koja se primijeti poslije sedam dana (kopija je već prepisana),
- gubitak samog naloga kod Hetznera ili brisanje u panelu.

Za veću izmjenu na serveru napravi **Snapshot** (Hetzner → server → Snapshots);
on ostaje dok ga sam ne obrišeš.

## Proba vraćanja — dva puta godišnje

Kopija koja se nikad nije probala nije kopija. Napravi praznu bazu, vrati u nju
zadnju kopiju i pogledaj ima li lekcija i učenika. Ako nešto ne valja, bolje je
saznati tada nego onda kad zatreba.

## Šta je unutra

Kopija sadržaja nosi **sve redove svih tabela** — i lične podatke učenika, pa je
dugme dostupno samo adminu, a datoteku čuvaj kao i svaki spisak djece.
Ne nosi priložene fajlove (oni su na disku) ni kod (on je na GitHubu).

Format je NDJSON: prvi red je zaglavlje, pa zatim red po red svake tabele.
Tabela koja u međuvremenu nestane iz baze preskače se pri vraćanju, a tabela
koja se pojavi ostaje prazna — kopija starija od izmjene baze i dalje radi.

| Fajl | Uloga |
|---|---|
| `api-server/src/lib/sigurnosna-kopija.ts` | pravi kopiju: redovi baze (NDJSON) i fajlovi (tar, pisan bez dodatne biblioteke) |
| `api-server/src/routes/admin.ts` | `GET /api/admin/sigurnosna-kopija`, `.../fajlovi` i `.../pregled` (admin-only) |
| `src/pages/admin-sigurnosna-kopija.tsx` | stranica u admin panelu |
| `scripts/src/vrati-sadrzaj.ts` | vraćanje kopije u bazu |
| `scripts/sigurnosna-kopija.sh` | kopija baze i fajlova sa servera |
