---
name: Banka pitanja — "Poredaj redom" konvencija i preview
description: Kako se kodira tačan redoslijed reorder pitanja i zašto preview mora sortirati
---

Za "Poredaj redom" (reorder) pitanja u banci: `opcije` drži tekstove stavki u AUTORSKOM redoslijedu (proizvoljan), a `correctOrder[i]` je POZICIJA (1..N) koju opcije[i] treba zauzeti u tačnoj sekvenci. Tačna sekvenca = stavke sortirane po `correctOrder` uzlazno. (Kviz player to potvrđuje: pretvara u `items: [{text, order}]` i radi `sort((a,b)=>a.order-b.order)`.)

**Why:** Postoje dvije plauzibilne konvencije (correctOrder[i] = pozicija stavke i, ILI = indeks stavke za poziciju i). Editor traži "upiši broj redoslijeda za ovu stavku" → znači POZICIJA stavke i. Collapsed preview u admin-banka-pitanja je ranije ispisivao `opcije` u sirovom storage redoslijedu (ne sortirano), pa je korisnik nakon ispravke i snimanja vidio "pogrešan raspored" iako su brojevi bili tačni — bila je to čisto display greška, podaci su bili ispravni.

**How to apply:** Bilo gdje gdje prikazuješ tačan redoslijed reorder pitanja, sortiraj `opcije` po `correctOrder` (fallback identitet 1..N kad dužine ne odgovaraju), ne oslanjaj se na storage redoslijed. U kvizu se stavke učeniku SHUFFLE-aju namjerno; storage redoslijed nije značajan.
