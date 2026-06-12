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
