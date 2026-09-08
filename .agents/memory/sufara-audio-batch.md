---
name: Sufara audio batch poslovi
description: Pouzdano izvođenje velikih OpenAI TTS i FFmpeg normalizacijskih poslova unutar Replit timeouta.
---

Velike Sufara audio regeneracije moraju biti resumable i izvođene u ograničenim foreground chunkovima. Sekvencijalni overwrite i normalizacija cijele biblioteke ne mogu završiti u jednom shell pozivu.

**Why:** OpenAI audio zahtjevi mogu trajati više minuta, a kompletna biblioteka ima stotine targeta. Visoka paralelizacija udara rate limit, dok FFmpeg normalizacija također prelazi petominutni limit i ostavlja samo bezopasne privremene izlaze.

**How to apply:** Za puni overwrite ukloni samo fajlove koje generator deklarira kao svoje targete, pa generator pokreći bez overwrite opcije da preskače završene fajlove. Koristi umjerenu paralelizaciju i ponavljaj foreground chunkove. Za FFmpeg koristi privremene markere izvan repoa i briši nedovršene `.normalizing.mp3` fajlove između chunkova; finalno provjeri da nema praznih ili temp MP3 fajlova.