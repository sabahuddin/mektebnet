#!/usr/bin/env bash
# Sigurnosna kopija cijelog mekteba: baza + priloženi fajlovi.
#
# Pokreni na serveru (Coolify → Terminal) ili iz crona:
#   DATABASE_URL=postgres://... UPLOADS_DIR=/app/uploads ./scripts/sigurnosna-kopija.sh /kopije
#
# Napravi dvije datoteke u ciljnom folderu i obriše kopije starije od 14 dana:
#   mekteb-baza-2026-09-18-1830.dump      (pg_dump, vraća se sa pg_restore)
#   mekteb-fajlovi-2026-09-18-1830.tar.gz (sve iz UPLOADS_DIR)
#
# Kopiju obavezno prebaci IZVAN servera (scp na svoj računar, oblak...) —
# kopija na istom disku ne pomaže kad disk nestane.
set -euo pipefail

CILJ="${1:-./kopije}"
CUVAJ_DANA="${CUVAJ_DANA:-14}"
ZIG="$(date +%Y-%m-%d-%H%M)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Nedostaje DATABASE_URL." >&2
  exit 1
fi

UPLOADS="${UPLOADS_DIR:-./uploads}"
mkdir -p "$CILJ"

echo "→ Baza…"
pg_dump --format=custom --no-owner --no-privileges \
  --file="$CILJ/mekteb-baza-$ZIG.dump" "$DATABASE_URL"

if [ -d "$UPLOADS" ]; then
  echo "→ Fajlovi iz $UPLOADS…"
  tar -czf "$CILJ/mekteb-fajlovi-$ZIG.tar.gz" -C "$UPLOADS" .
else
  echo "! Folder $UPLOADS ne postoji — fajlovi nisu kopirani." >&2
fi

echo "→ Brišem kopije starije od $CUVAJ_DANA dana…"
find "$CILJ" -maxdepth 1 -name 'mekteb-baza-*.dump' -mtime "+$CUVAJ_DANA" -delete
find "$CILJ" -maxdepth 1 -name 'mekteb-fajlovi-*.tar.gz' -mtime "+$CUVAJ_DANA" -delete

echo "Gotovo:"
ls -lh "$CILJ" | tail -n +2
