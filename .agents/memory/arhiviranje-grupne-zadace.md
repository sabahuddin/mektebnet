---
name: Arhiviranje grupne zadaće
description: Pravilo statusa učenika kada muallim arhivira zadaću dodijeljenu cijeloj grupi.
---

Arhivirati se može samo zadaća dodijeljena cijeloj grupi. Arhiviranje ne briše zadaću: učeniku koji ju je realizovao ostaje u „Završeno“, a učeniku bez završenog statusa prelazi u „Neurađeno“.

**Why:** Arhiva predstavlja završetak perioda u kojem je grupna zadaća bila aktivna, ali historija mora jasno razlikovati realizovane i nerealizovane obaveze svakog učenika.

**How to apply:** Svaki novi prikaz, API ili izvještaj zadaća treba tretirati neaktivnu grupnu zadaću kao završenu samo za učenike sa završenim statusom; za ostale je nerealizovana.