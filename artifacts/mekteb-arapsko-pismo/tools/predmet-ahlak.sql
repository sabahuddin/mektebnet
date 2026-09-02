-- Postavljanje predmeta „Ahlak“ za 61 lekciju (Nivoi 1, 2, 21 i 3).
-- Izvedeno iz naslova i sadržaja lekcija; granični slučajevi su označeni u
-- popisu koji je uz ovo isporučen. Prije pokretanja OBAVEZNO backup baze.
--
-- KORAK 1 — pogledaj šta je već postavljeno, ništa se ne mijenja:
--   SELECT predmet, COUNT(*) FROM ilmihal_lekcije GROUP BY predmet ORDER BY 2 DESC;
--
-- KORAK 2 — pogledaj koje bi lekcije ovaj skript dirnuo:
--   SELECT nivo, redoslijed, naslov, predmet FROM ilmihal_lekcije
--   WHERE slug IN (...) AND predmet IS DISTINCT FROM 'Ahlak' ORDER BY nivo, redoslijed;
--
-- KORAK 3 — tek onda UPDATE ispod. Namjerno dira SAMO lekcije bez predmeta,
-- da ne pregazi ono što je muallim ili backfill iz priprema već upisao.
-- Ako želiš prepisati i postojeće, ukloni uslov `predmet IS NULL`.

BEGIN;

-- ── Nivo 1 ──
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'prednost-desne-strane' AND predmet IS NULL;  -- Prednost desne strane
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'pravila-ponasanja' AND predmet IS NULL;  -- Islamska pravila ponašanja
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'ulazak-izlazak' AND predmet IS NULL;  -- Ponašanje pri ulasku i izlasku
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'selam' AND predmet IS NULL;  -- Islamski pozdrav - selam
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'sport' AND predmet IS NULL;  -- Sport i rekreacija
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'voda-izvor-zivota' AND predmet IS NULL;  -- Voda je izvor života
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'zuri-mirza-na-pouku' AND predmet IS NULL;  -- Žuri Mirza na pouku
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'za-bajram-je-pohvalno' AND predmet IS NULL;  -- Za Bajram je lijepo i pohvalno
-- ── Nivo 2 ──
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'cistoca' AND predmet IS NULL;  -- Čistoća i lična higijena
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'ishrana' AND predmet IS NULL;  -- Zdrava ishrana
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'ponasanje-jela' AND predmet IS NULL;  -- Ponašanje prilikom jela
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'braca-sestre' AND predmet IS NULL;  -- Pažnja prema sestrama i braći
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'veliki-grijesi' AND predmet IS NULL;  -- Veliki grijesi
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'teski-grijesi' AND predmet IS NULL;  -- Teški grijesi
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'posljedice-grijeha' AND predmet IS NULL;  -- Posljedice grijeha
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'cestitost' AND predmet IS NULL;  -- Čestitost i odgovornost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'radne-navike' AND predmet IS NULL;  -- Razvijanje radne navike
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'srednji-put' AND predmet IS NULL;  -- Uloga i važnost srednjeg puta
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'istina' AND predmet IS NULL;  -- Važnost i snaga istine
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'prevara' AND predmet IS NULL;  -- Prevara, laž i krađa
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'ponasanje-drustvo' AND predmet IS NULL;  -- Ponašanje u društvu
-- ── Nivo 21 ──
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'urednost' AND predmet IS NULL;  -- Urednost muslimana
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'zdravlje' AND predmet IS NULL;  -- Dužnost čuvanja zdravlja
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'rodbina' AND predmet IS NULL;  -- Dužnosti prema rodbini
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'mali-grijesi' AND predmet IS NULL;  -- Vrste grijeha - Mali grijesi
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'tevba' AND predmet IS NULL;  -- Tevba - pokajanje
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'iskrenost' AND predmet IS NULL;  -- Iskrenost i saosjećajnost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'skromnost' AND predmet IS NULL;  -- Skromnost i umjerenost
-- ── Nivo 3 ──
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'porodica' AND predmet IS NULL;  -- Uloga i značaj porodice
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'brak' AND predmet IS NULL;  -- Islamski brak
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'zenidba-udaja' AND predmet IS NULL;  -- Ženidba i udaja
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'odijevanje-hidzab' AND predmet IS NULL;  -- Kultura odijevanja, hidžab – smisao i značaj
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'odgovornost-zdravlje' AND predmet IS NULL;  -- Odgovornost prema životu i zdravlju
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'rad-kultura' AND predmet IS NULL;  -- Rad i radna kultura
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'stjecanje-znanja' AND predmet IS NULL;  -- Stjecanje znanja
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'roditelji' AND predmet IS NULL;  -- Poslušnost i briga prema roditeljima
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'rodbinske-veze' AND predmet IS NULL;  -- Čuvanje rodbinskih veza
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'komsije' AND predmet IS NULL;  -- Dužnosti prema komšijama
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'prijateljstvo' AND predmet IS NULL;  -- Prijateljstvo i drugarstvo
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'stariji' AND predmet IS NULL;  -- Poštivanje starijih
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'poboznost' AND predmet IS NULL;  -- Pobožnost i bogobojaznost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'iskrenost-pravednost' AND predmet IS NULL;  -- Iskrenost i pravednost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'strpljivost' AND predmet IS NULL;  -- Predanost i strpljivost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'istinoljubivost' AND predmet IS NULL;  -- Istinoljubivost i pouzdanost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'dobrota' AND predmet IS NULL;  -- Dobrota i ustrajnost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'samilost' AND predmet IS NULL;  -- Samilost i praštanje
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'skrtost' AND predmet IS NULL;  -- Škrtost i zavidnost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'ogovaranje' AND predmet IS NULL;  -- Ogovaranje
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'oholost' AND predmet IS NULL;  -- Oholost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'mrznja' AND predmet IS NULL;  -- Mržnja i ljubomora
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'neprijateljstvo' AND predmet IS NULL;  -- Neprijateljstvo
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'droga' AND predmet IS NULL;  -- Droga – štetnost i posljedice
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'alkohol' AND predmet IS NULL;  -- Alkohol i alkoholna pića
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'duhan' AND predmet IS NULL;  -- Duhan – upotreba i njegova štetnost
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'nemoral' AND predmet IS NULL;  -- Nemoral – blud, čuvanje i posljedice
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'internet-ovisnost' AND predmet IS NULL;  -- Ovisnost o internetu
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'kockanje' AND predmet IS NULL;  -- Kockanje, igre na sreću i sportske kladionice
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'ekologija' AND predmet IS NULL;  -- Čuvanje okoline – ekologija
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'biljke-zivotinje' AND predmet IS NULL;  -- Odnos prema biljnom i životinjskom svijetu
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'lijepa-rijec' AND predmet IS NULL;  -- Lijepa riječ
UPDATE ilmihal_lekcije SET predmet = 'Ahlak' WHERE slug = 'prava-dzematlija' AND predmet IS NULL;  -- Prava i dužnosti džematlija

-- Provjera prije potvrde:
SELECT nivo, COUNT(*) AS ahlak FROM ilmihal_lekcije WHERE predmet = 'Ahlak' GROUP BY nivo ORDER BY nivo;

-- COMMIT;   -- otkomentariši tek kada si zadovoljan rezultatom
ROLLBACK;  -- zadano: ništa se ne mijenja dok ovo ne zamijeniš sa COMMIT
