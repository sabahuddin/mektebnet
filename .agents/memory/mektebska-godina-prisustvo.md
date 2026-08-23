---
name: Mektebska godina — prisustvo
description: Pravilo granice za tekući pregled prisustva.
---

Pregled prisustva za tekuću mektebsku godinu obavezno počinje **1. augusta**.

**Why:** Nova mektebska godina se resetuje 1. augusta. Stari zapisi mogu ostati sačuvani za historiju, ali ne smiju ući u tekući pregled samo zato što učenik još ima staru grupu ili muallim otvori profil bez eksplicitnog filtra.

**How to apply:** Svaki novi ili izmijenjeni pregled/statistika prisustva mora server-side ograničiti datume od početka tekuće mektebske godine; nikad ne oslanjati se samo na frontend, kalendarsku godinu ili trenutni `grupaId`.