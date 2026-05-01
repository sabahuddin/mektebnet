# H5P šabloni — Mekteb.net

Ovaj direktorij sadrži .h5p starter šablone koje muallimi mogu preuzeti, otvoriti u
[Lumi Education](https://lumi.education/) desktop aplikaciji, zamijeniti tekst/slike
svojim sadržajem i ponovo eksportovati u .h5p za upload u Mekteb.

## Trenutni šabloni

Pogledaj listu na stranici `/muallim/h5p-uputstvo` u aplikaciji. Svaki šablon
očekuje fajl pod istim imenom u ovom direktoriju, npr. `harfovi-drag.h5p`.

## Kako dodati novi šablon (za admin/maintainer-a)

1. Otvori Lumi Education na računaru.
2. Napravi novu H5P vježbu željenog tipa (npr. Drag the Words, Multiple Choice, Image Pairs).
3. Popuni je generičkim primjerom koji muallim može lahko izmijeniti.
4. Klikni "Save as .h5p" i sačuvaj fajl pod imenom koje stranica `h5p-uputstvo.tsx`
   referencira (vidi konstantu `H5P_TEMPLATES`).
5. Stavi fajl u ovaj direktorij i commit-aj.
6. Stranica će automatski pokazati dugme "Preuzmi" umjesto "Uskoro".

## Sigurnost

Ovi fajlovi su javno preuzimljivi (servirani su preko Vite static handler-a kao i
ostatak `public/`). Ne stavljaj ovdje ništa što sadrži lične podatke učenika ili
osjetljiv sadržaj.
