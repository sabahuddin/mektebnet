---
name: Dostupni jezici po muallimu
description: Kako je riješeno admin-kontrolisano ograničavanje jezika po muallimu i zašto je enforcement na UI nivou.
---

# Dostupni jezici po muallimu

Admin po muallimu uključuje/isključuje jezike (`muallim_profili.dozvoljeni_jezici` jsonb,
default svi). Učenici prate svog muallima (JOIN `ucenik_profili.muallim_id`); admin i
roditelj imaju sve. Bosanski je UVIJEK uključen (forsira se i na backendu i u UI). Gost
vidi sve dugmiće ali samo `bs` radi — ostali daju toast "prijavite se".

- Endpoint za rezoluciju: `GET /api/content/dozvoljeni-jezici` (requireAuth), `req.user.userId`/`role`.
- Postavljanje: `PUT /api/admin/muallim/:id/jezici` (validira subset SVI_JEZICI, forsira bs).
- Switcher (`layout.tsx`) koristi `useQuery` keyed na `user.id`; fallback dok se ne učita =
  samo `["bs", trenutniLang]` (NE svi) da ne otkrije nedozvoljene jezike.

**Why (enforcement je namjerno UI-level):** UI tekstovi su bundlani client-side (t() čita
lokalni JSON po `localStorage.mekteb-lang`), pa se jezik INTERFEJSA principijelno ne može
enforce-ati na serveru. Jedini server-dotaknut dio je DB-sadržaj preko `X-Lang` headera, a
te content rute su javne (bez auth) i dijeljene za sve — backend clamp bi tražio
token-parsiranje + DB upit na SVAKI content zahtjev (perf + rizik regresije). Za ovaj domen
(kuracija jezika za djecu, ne zaštita osjetljivih podataka) to je svjesno van opsega.

**How to apply:** Ako ikad zatreba "tvrdi" enforcement sadržaja, clamp bi išao u
`content-translatable.ts getLang(req)` uz keširan allowed-set po korisniku — ali tek nakon
potvrde da perf trošak na javnim content rutama vrijedi.
