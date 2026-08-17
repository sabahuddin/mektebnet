---
name: Dev grupe su is_active=false
description: Zašto agregatne statistike (mekteb/muallim/grupa) u dev bazi izgledaju prazne iako grupe i učenici postoje
---

Demo grupe u dev bazi imaju `grupe.is_active = false`, a sve agregatne statističke rute filtriraju
`COALESCE(is_active, true) = true` uz `is_archived = false`. Zato `/muallim/mekteb/statistika` i
`/muallim/statistika-mekteb` vraćaju nule i prazan `perGrupa` iako u tabelama ima učenika, kvizova i bodova.

**Why:** lako se pogrešno zaključi da je agregacija pokvarena i krene se "popravljati" backend koji je ispravan.

**How to apply:** za ručnu provjeru agregata privremeno `UPDATE grupe SET is_active=true WHERE id IN (...)`,
izmjeri, pa obavezno vrati na `false`. Isto vrijedi i za privremeno postavljanje `muallim_profili.is_glavni`
kad se testira mektebski (glavni muallim) nivo — vrati original poslije.
