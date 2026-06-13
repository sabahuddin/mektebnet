---
name: Custom audio plejer u lekcijama
description: Zašto i kako lekcijski <audio> dobija prilagođeni "Mektebnet" plejer umjesto nativnog kontrolera.
---

# Prilagođeni "Mektebnet" audio plejer

Nativni `<audio controls>` se NE koristi direktno u lekcijama — wrappamo ga u
`.mekteb-audio` (play dugme, progress, natpis "Mektebnet").

**Why:** Chrome za audio bez poznatog trajanja (VBR MP3 koji prijave
`duration=Infinity`) prikaže natpis "Emitiranje uživo" / "Live broadcast" koji se
NE može promijeniti niti se nativni kontroler pouzdano centrirati/stilizovati.

**How to apply:**
- Učenička staza: `RjecnikContent` ima `useEffect` na `[processed]` koji zove
  `enhanceAllAudioPlayers(ref.current)` (jer `dangerouslySetInnerHTML` iznova
  kreira audio elemente pri svakom renderu). Idempotentno preko
  `audio.dataset.mektebAudio`.
- Editor staza: Tiptap `AudioBlock` ima `addNodeView()` → `buildAudioPlayer()`.
  KRITIČNO: `renderHTML` (serijalizacija/`getHTML`) mora ostati goli
  `<audio controls class="lesson-audio">` da snimljeni HTML bude običan audio koji
  učenik dobije wrapan preko `RjecnikContent`. NodeView mijenja SAMO prikaz u
  editoru, ne serijalizaciju.
- Trajanje za Infinity-duration fajlove: skoči `currentTime = 1e101` pa nazad na 0
  da browser izračuna stvarno trajanje. Ako ostane Infinity, seek/progress se
  graciozno onemoguće (prikaže se samo proteklo vrijeme).
- Metapodaci mogu biti učitani PRIJE nego se zakači `loadedmetadata` (keširan
  audio) → pozovi handler i ručno ako je `audio.readyState >= 1`, inače seek
  ostaje trajno onemogućen.
- Admin raw-HTML preview staze (dangerouslySetInnerHTML u ilmihal-lekcija.tsx)
  su NAMJERNO nepokrivene (admin-only, niži prioritet).

# Seek/premotavanje mora podržavati prevlačenje + dodir

Seek-traka NE smije biti samo klik na tanku liniju. Treba: vidljiva ručica (thumb),
veća dodirna zona (bar ~20px iako je vizuelna traka 7px), i prevlačenje preko
**Pointer Events** (pointerdown/move/up + setPointerCapture), uz `touch-action:none`
na baru da prevlačenje ne skrola stranicu.
**Why:** Korisnik je prijavio "nema opciju da premotavam"; klik-only seek na 7px traci
bez ručice djeci na tabletima izgleda kao da seek ne postoji. Pattern je isti kao kod
reorder UI-ja (vidi reorder-touch-drag.md) — djeca su na tabletima, HTML5 drag ne radi.
**How to apply:** Tokom prevlačenja radi samo VIZUELNI preview (ne diraj
`audio.currentTime` dok ne pustiš, da reprodukcija ne trza); commit na pointerup.
`update()` (timeupdate handler) mora imati `if (dragging) return` da playback ne
pregazi preview. Ručicu/seek prikaži tek kad je trajanje poznato (`.is-seekable`),
jer Infinity-duration fajlovi i dalje gase seek graciozno. Dodaj i `durationchange`
listener (ne samo loadedmetadata) — trajanje za neke fajlove stigne naknadno.

# Cloudflare guta Range → seek se vraćao na 0 (blob fallback)

Premotavanje (drag commit postavi `audio.currentTime`) na PRODUKCIJI je uvijek vraćalo
snimak na 0, iako u dev-u radi. Uzrok NIJE klijent: `express.static` na originu vraća
`206` + `accept-ranges`, ali Cloudflare ISPRED mekteb.net (čak i na cache MISS) vrati
`200` bez `accept-ranges`/`content-range` — dakle Range zahtjev se IGNORIŠE. Tada je
`audio.seekable` prazan pa svaki `currentTime=` resetuje na 0 (i nativni plejer pokaže
"Emitiranje uživo" jer trajanje ostane nepoznato).
**Why:** Ne mogu mijenjati Cloudflare/Coolify proxy iz koda; fix mora biti klijentski i
otporan na proxy koji ne servira 206.
**How to apply:** U `enhanceAudioPlayer` postavi `preload="none"`, pa `ensureSeekable()`:
`fetch(src, {headers:{Range:"bytes=0-1"}})`. Ako `206` → server poštuje Range, pusti
direktan (streaming) izvor (`preload=metadata`+`load()`). Ako `200` → Range ignorisan a
tijelo TOG odgovora JE cijeli fajl → `URL.createObjectURL(blob)` i postavi kao `audio.src`
(blob URL je uvijek potpuno premotljiv, podaci su lokalni; jedno preuzimanje). Bail na
direktan izvor kod fetch throw / `!probe.ok` / `text/html` / prazan blob. Probe za 206 je
2 bajta (jeftino u dev-u); puni download samo tamo gdje Range ionako ne radi. Dijagnoza:
`curl -D- -H "Range: bytes=1000-2000" <url>` → 206 znači da Range radi, 200 da ne radi.
Poznati kompromis: blob URL se NE revoke-uje (curenje vezano za životni vijek stranice) —
ok za kratke lekcijske klipove; ako editor pravi mnogo plejera u jednoj sesiji, dodaj revoke.
