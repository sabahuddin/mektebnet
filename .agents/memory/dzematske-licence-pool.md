---
name: Zajedničke licence džemata
description: Poslovno pravilo za kapacitet učenika i prikaz iskorištenosti po muallimu.
---

Kapacitet je zajednički za sve muallime istog džemata: broj kupljenih licenci iz najnovije pretplate glavnog muallima, a bez nje zbir dodijeljenih muallimskih kvota. Pojedinačne kvote muallima unutar džemata ne ograničavaju upis.

**Why:** Korisnik želi jedan ukupni limit u opisu džemata i samo stvarni broj vezanih učenika uz svakog muallima; stari per-muallim limiti blokirali su upis i kad je džemat imao slobodnih licenci.

**How to apply:** Računaj samo nearhivirane učenike, uključujući neaktivne koji su i dalje vezani; naslijeđeni profili bez mekteb_id pripadaju džematu svog muallima. Kapacitet i brojanje provjeri atomarno pri upisu i prelazu u drugi džemat, a transfer između muallima istog džemata ne troši novu licencu. Samostalne porodične/individualne pretplate ne ulaze u džematski zbir.

**Prikaz po muallimu:** Za učenika raspoređenog u grupu, broj u Admin tabeli „Vezani učenici” pripiši *odgovornom vlasniku grupe*, ne historijskom direktnom `muallim_id` iz profila. Učenika bez važeće grupe pripiši direktnom muallimu. Ukupna potrošnja licenci džemata ostaje broj jedinstvenih učenika, ne zbir učešća dodatnih muallima.

**Why:** Grupe mogu biti raspoređene na više muallima dok profili svih učenika i dalje upućuju na prvog/glavnog; direktno brojanje tada lažno prikazuje ostalima nulu.

**How to apply:** Ne mijenjaj veze učenika u bazi radi prikaza. Za broj po muallimu slijedi odgovornog grupnog muallima, a dodatne muallime iste grupe ne broj dvaput.