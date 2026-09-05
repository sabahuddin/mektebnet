---
name: Auth hidratacija prije redirecta
description: Sprječavanje lažnih guest gateova i redirecta tokom obnove prijave nakon punog reloada.
---

Zaštićene stranice i role-based content gateovi moraju čekati da `useAuth().isLoading` postane `false` prije provjere `user`, pokretanja guest fetch-a ili redirecta.

**Why:** AuthProvider obnavlja token i korisnika iz localStoragea u efektu. Odmah nakon punog reloada `user` je kratko `null`; bez čekanja admin može dobiti guest poruku i biti preusmjeren iako je uredno prijavljen.

**How to apply:** Svaki ekran koji radi `if (!user) setLocation(...)`, ili bira guest/admin pristup pri prvom fetchu, prvo mora imati `if (authLoading) return`.