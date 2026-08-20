---
name: Scoped route guards
description: Express router middleware must be constrained when the router is mounted at the API root.
---

Zaštitni middleware na routeru koji je montiran bez URL prefiksa mora biti vezan za konkretne podputanje koje taj router poslužuje, a ne na goli `router.use(...)`.

**Why:** Express izvršava takav middleware za svaki naredni API zahtjev. Učenički `requireRole` tada može vratiti 403 i za admin ili muallim rute prije nego njihove vlastite provjere dobiju priliku da se izvrše.

**How to apply:** Kada jedan router obuhvata više već postojećih prefiksa (npr. napredak i vježbe), dodaj guard za svaki relevantni prefiks. Alternativno ga montiraj pod jedinstvenim prefiksom. Regresijski test treba potvrditi i zaštićenu ciljnu rutu i barem jednu rutu druge uloge.