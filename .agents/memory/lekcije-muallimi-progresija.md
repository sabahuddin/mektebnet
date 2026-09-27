---
name: Lekcije samo za muallime i progresija
description: Pravilo za usklađivanje role-based dostupnosti lekcije sa svim studentskim progression gateovima.
---

Lekcija označena kao dostupna samo muallimima i adminima mora biti isključena iz svih studentskih progression zahtjeva: redoslijeda otključavanja, etapa, medaljona i krunisanja. Ipak, muallim je smije zadati učeniku; tada učenik dobija pristup direktno kroz aktivnu zadaću.

**Why:** Učenik takvu lekciju ne vidi u katalogu i ne smije mu blokirati redovni napredak, ali zadaća predstavlja namjerni izuzetak za direktan pristup.

**How to apply:** Svaki novi upit koji računa obavezne ili završene Ilmihal lekcije za učenika mora uključiti samo lekcije čija je dostupnost `svi`.

Javna uvodna lekcija Nivoa 1 je izuzetak od pravila da svaka lekcija dostupna svima pripada progresiji. Ona se prikazuje prije prve redovne lekcije, ali nema broj i ne učestvuje u redoslijedu mape, pozicijama etapa, medaljonima, krunisanju, bedževima i broju završenih redovnih lekcija.

**Why:** Prebacivanje uvoda iz `muallimi` u `svi` samo po sebi bi ga ubacilo u sve upite koji traže javne lekcije, uslovilo polaganje etapa i krunisanja njegovim završetkom i pomjerilo brojeve lekcija. Promjena redoslijeda drugih lekcija bi promijenila granice postojećih etapa.

**How to apply:** Izuzimaj tačan slug uvoda Nivoa 1 iz progresijskih upita, a zadrži njegov pristup u javnom katalogu i na stranici lekcije. Ne filtriraj sve lekcije sa `redoslijed <= 0`: Nivo 2 ima redovnu lekciju na poziciji 0, a uvodi Nivoa 2 i 3 su odvojena, postojeća pravila.