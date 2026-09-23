# Coolify server — disk i Docker build cache

Ovo se podešava **na Hetzner hostu**, ne u Coolify aplikacijskom kontejneru i
ne na Replit Publishu. Host skripta je `scripts/coolify-disk-guard.sh`.

## Šta radi

- Svakih 15 minuta provjerava `df -P /`. Na **80% ili više** šalje e-mail
  primaocu u `/etc/mekteb-disk-guard.conf`; ako zauzeće ostane visoko, šalje
  najviše jednom u 24 sata. Neuspjelo slanje pokušava ponovo pri narednoj
  provjeri. Nakon pada ispod 80% resetuje stanje.
- Svake nedjelje u 03:45 UTC izvršava samo `docker builder prune --force
  --filter 'until=168h'`. Time uklanja samo neiskorišteni build cache stariji
  od sedam dana. Dockerov BuildKit na ovom hostu ne podržava dodatni limit
  ciljane veličine (`--max-used-space`), pa je ograničenje **starost cachea**,
  ne broj oslobođenih gigabajta. Ne koristi `docker system prune`, `image prune` ni
  `volume prune`; ne dira baze, volumene ni aktivne slike.
- Slanje koristi već postojeći SMTP **u Mekteb aplikacijskom kontejneru**.
  Skripta bira aktivni kontejner po stabilnoj Coolify labeli, pa redeploy s
  novim imenom kontejnera ne zahtijeva novu konfiguraciju. Lozinka SMTP-a se
  ne kopira na host i nije u repozitoriju. Ako je sama aplikacija ugašena ili
  njen SMTP ne radi, e-mail ne može otići; greška ostaje u sistemskom logu.

Čišćenje starog cachea oslobađa prostor, ali **naredni Docker build može
trajati duže** jer će se neki slojevi ponovo izgraditi/preuzeti. Ne prekida
pokrenute kontejnere. Ako prostor troše logovi, backupi ili slike umjesto
build cachea, ova skripta to neće popraviti: istražiti uzrok, bez brisanja
podataka na slijepo.

## Instalacija na hostu (root)

Kopirati skriptu na `/usr/local/sbin/mekteb-disk-guard`, zatim:

```sh
chown root:root /usr/local/sbin/mekteb-disk-guard
chmod 700 /usr/local/sbin/mekteb-disk-guard
cat > /etc/mekteb-disk-guard.conf <<'EOF'
ALERT_EMAIL='adresa-primaoca@example.com'
APP_LABEL='coolify.applicationId=5'
EOF
chown root:root /etc/mekteb-disk-guard.conf
chmod 600 /etc/mekteb-disk-guard.conf
cat > /etc/cron.d/mekteb-disk-guard <<'EOF'
*/15 * * * * root /usr/local/sbin/mekteb-disk-guard check 2>&1 | /usr/bin/logger -t mekteb-disk-guard
45 3 * * 0 root /usr/local/sbin/mekteb-disk-guard prune 2>&1 | /usr/bin/logger -t mekteb-disk-guard
EOF
chown root:root /etc/cron.d/mekteb-disk-guard
chmod 644 /etc/cron.d/mekteb-disk-guard
```

Na drugom serveru vrijednost `APP_LABEL` se mora provjeriti preko
`docker ps --filter label=coolify.applicationId=5`. Testirati:

```sh
bash -n /usr/local/sbin/mekteb-disk-guard
/usr/local/sbin/mekteb-disk-guard test-mail
/usr/local/sbin/mekteb-disk-guard check
df -h /
docker system df
journalctl -t mekteb-disk-guard --since today
```

Provjeriti da je probni e-mail stvarno stigao i da se Coolify otvara prije i
poslije prvog čišćenja. Ručna provjera upozorenja bez punjenja diska:
`DISK_GUARD_THRESHOLD=40 /usr/local/sbin/mekteb-disk-guard check` (ako je
trenutno zauzeće iznad 40%), pa pokrenuti obični `check` da se probni status
resetuje. Redovni cron **uvijek koristi 80%**.

## Provjera i uklanjanje

`journalctl -t mekteb-disk-guard` prikazuje početak/kraj čišćenja i greške
slanja. `docker system df` prikazuje preostali cache. Za hitnu procjenu prije
bilo kakvog ručnog čišćenja: `df -h /` i `docker system df`. Ne pokretati
`docker system prune -a --volumes`.

Ako se održavanje više ne želi: ukloniti `/etc/cron.d/mekteb-disk-guard`,
`/usr/local/sbin/mekteb-disk-guard`, `/etc/mekteb-disk-guard.conf` i
`/var/lib/mekteb-disk-guard`. To ne vraća obrisani cache (sljedeći build ga
ponovo stvara). Poslije završetka pristupa ukloniti i privremeni SSH ključ iz
`/root/.ssh/authorized_keys`.