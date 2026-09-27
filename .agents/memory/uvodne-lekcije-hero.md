---
name: Uvodne lekcije su uređiv sadržaj
description: Zašto automatske migracije sadržaja uvodnih lekcija brišu slike i kako sigurno pristupiti oporavku.
---

Nikad ne prepisuj `content_html` već postojeće uvodne lekcije tokom svakog starta servera na osnovu HTML klasa poput `hero-box` ili `lesson-container`. To su legitimni elementi koje dodaje editor, ne dokaz zastarjelog sadržaja.

**Why:** Stariji cleanup zamjenjivao je cijeli HTML uvoda Nivoa 1 čim bi korisnik dodao hero sliku, jer je njen prikaz imao klasu `hero-box`. Fajl slike je preživio u trajnim uploadima, ali je veza nestajala iz bosanske lekcije nakon svakog pokretanja servera.

**How to apply:** Za nove uvodne lekcije može se koristiti `INSERT ... ON CONFLICT DO NOTHING`, ali postojeći urednički sadržaj mora ostati netaknut. Prije oporavka izgubljene slike provjeri prijevode ili backup za izvorni URL, potvrdi da javna putanja vraća stvarni `image/*`, sačuvaj rezervnu kopiju produkcijskog reda i piši samo uslovljeno. Vraćanje slike prije produkcijskog redeploya ispravke može ponovo biti poništeno starim startup kodom.