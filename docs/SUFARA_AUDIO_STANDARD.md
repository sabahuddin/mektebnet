# Standard audiozapisa za Sufaru

Sufara se priprema za čitanje Kur'ana prema kiraetu **Hafs od Asima**. Browser
TTS i generički arapski AI glasovi ne smiju biti izvor istine za mahredž,
dužinu glasa, sukun, tešdid ili tenvin.

## Status postojećih snimaka

Postojeći fajlovi u `public/audio/harfovi` i `public/audio/slogovi` nastali su u
razvojnoj fazi. Prije javnog otvaranja Sufare svaki snimak mora preslušati i
odobriti kvalificirani učač Kur'ana. Neodobren snimak se ne označava kao
provjeren samo zato što tehnički radi.

## Pravila snimanja

- Jedan učač za cijeli početni nivo, bez promjene dijalekta i boje glasa.
- Snimati neutralno i razgovijetno, bez melodijskog pretjerivanja i bez eha.
- Master: mono WAV, 48 kHz, 24-bit. Web kopija: MP3 128–192 kbps.
- Početna i završna tišina: približno 120–200 ms.
- Harf se snima kao naziv harfa i, zasebno, kao glas u slogu.
- Sukun se nikada ne snima samostalno; koristi se u zatvorenom slogu, npr.
  `أَبْ`, `بَتْ`.
- Tešdid se snima u kontekstu, npr. `أَبَّ`, `إِنَّ`, `ثُمَّ`; ne kao
  izolirano `بّ`.
- Tenvin se snima najmanje dvaput: u povezanom čitanju i pri stajanju.
- Svaki fajl moraju potvrditi učač i drugi preslušavač prije statusa
  `approved`.

## Imenovanje

Koristiti stabilne, opisne nazive:

```text
harf-ba-name.mp3
ba-fatha.mp3
ba-kesra.mp3
ba-damma.mp3
ab-sukun.mp3
abba-tesdid.mp3
ba-tanwin-fatha-connected.mp3
ba-tanwin-fatha-stop.mp3
```

## Evidencija odobrenja

Uz snimke treba održavati CSV ili JSON sa poljima:

```text
id, arabic, latin_help, file, reciter, reviewer, qiraah, status, reviewed_at
```

Dozvoljeni statusi su `draft`, `needs_review`, `approved` i `rejected`.
Produkcijski interfejs smije koristiti samo zapise sa statusom `approved`.

## Procjena vanjskih izvora

- [Quran Foundation Audio API](https://api-docs.quran.foundation/docs/sdk/javascript/audio/)
  daje provjerljive metapodatke i snimke ajeta, ali zahtijeva backend i pristupne
  podatke. Prikladan je za kasnije kur'anske primjere, ne za izolirane harfove.
- [Quran Foundation word timestamps](https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/audio-reciter-timestamp/)
  omogućavaju ponavljanje cijele riječi. Ne treba rezati jedan glas iz sredine
  riječi jer susjedni harfovi utiču na njegov zvuk.
- [MP3Quran](https://www.mp3quran.net/eng/) omogućava izbor predaje Hafs od
  Asima, ali nudi cjelovite recitacije, ne komplet Sufara slogova.
- [EveryAyah](https://everyayah.com/) nudi kvalitetne snimke po ajetima, ali
  prije lokalnog kopiranja treba posebno potvrditi prava korištenja odabranog
  snimka.

Zaključak: vanjske recitacije koristiti za cijele kur'anske riječi i ajete tek
nakon provjere uslova izvora. Izolirane harfove, hemze, harekete, sukun, tešdid
i tenvin treba snimiti kao vlastiti, ujednačen komplet s jednim učačem.
