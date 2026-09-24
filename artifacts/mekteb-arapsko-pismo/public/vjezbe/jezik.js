/**
 * Sučelje naših vježbi na jeziku djeteta.
 *
 * Vježba se otvara u iframe-u, a iframe ne može poslati `X-Lang` zaglavlje,
 * pa jezik stiže kroz upit: `?lang=de`. Isti parametar stranica lekcije
 * dopisuje na URL vježbe (vidi `src/lib/nase-vjezbe.ts`), a vježba ga šalje
 * dalje API-ju koji vraća prevedeni sadržaj.
 *
 * Ključ u rječniku je BOSANSKI izvorni tekst — isto kao u `t()` u aplikaciji.
 * Nema li prijevoda, ostaje bosanski, pa vježba nikad ne ostane bez teksta.
 *
 * Statički tekst u HTML-u se prevodi odmah pri učitavanju ove datoteke, dok
 * je na stranici samo ono što je pisac vježbe upisao. Zato ovaj `<script>`
 * stoji neposredno prije glavne skripte vježbe: sve poslije toga ide kroz
 * `T(...)`, pa se sadržaj vježbe (riječi, pitanja) nikad ne pokušava prevesti.
 *
 * Zamjene u tekstu idu kao %ime% — vitičaste zagrade su zauzete, jer u vježbi
 * „Popuni prazninu" {ovako} označava prazninu u priči.
 */
(function (global) {
  "use strict";

  var RJECNIK = {
    de: {
      /* — zajedničko — */
      "Mekteb.net · vježba": "Mekteb.net · Übung",
      "Vrijeme": "Zeit",
      "Vrijeme: %vrijeme%.": "Zeit: %vrijeme%.",
      "Vrijeme: %vrijeme%. %pomoc%": "Zeit: %vrijeme%. %pomoc%",
      "%broj% od %ukupno%": "%broj% von %ukupno%",
      "0 od 0": "0 von 0",
      "Provjeri": "Prüfen",
      "Pomozi mi": "Hilf mir",
      "Počni ispočetka": "Von vorn beginnen",
      "Pokušaj ponovo": "Versuch es noch einmal",
      "Igraj ponovo": "Noch einmal spielen",
      "Nova igra": "Neues Spiel",
      "Za ovu vježbu treba uključiti JavaScript.": "Für diese Übung muss JavaScript eingeschaltet sein.",
      "Bez pomoći.": "Ohne Hilfe.",
      " Pomoć korištena jednom.": " Hilfe einmal benutzt.",
      "Pomoć korištena jednom.": "Hilfe einmal benutzt.",
      " Pomoć korištena %broj% puta.": " Hilfe %broj%-mal benutzt.",
      "Pomoć korištena %broj% puta.": "Hilfe %broj%-mal benutzt.",
      " Iz prve tačno: %broj% od %ukupno%.": " Auf Anhieb richtig: %broj% von %ukupno%.",
      " Iz prve sve tačno!": " Auf Anhieb alles richtig!",
      "Vraćeno. %tekst%": "Zurückgelegt. %tekst%",
      "Prazno": "Leer",

      /* — nauči napamet — */
      "Nauči napamet · Mekteb.net": "Auswendig lernen · Mekteb.net",
      "Nauči napamet": "Auswendig lernen",
      "Ajet": "Vers",
      "Naučeno": "Gelernt",
      "Prati": "Mitlesen",
      "Gradi suru": "Sure aufbauen",
      "Ponavljaj": "Wiederholen",
      "Slušaj ajet": "Vers anhören",
      "Ponovi 3×": "3× wiederholen",
      "Prethodni": "Vorheriger",
      "Sljedeći": "Nächster",
      "Cijela sura": "Ganze Sure",
      "1. ajet → 1+2 → cijela sura": "1. Vers → 1+2 → ganze Sure",
      "Korak %broj% od %ukupno%": "Schritt %broj% von %ukupno%",
      "Prouči sve što vidiš tri puta. Kad ti ide bez greške, dodaj sljedeći ajet.":
        "Lies alles, was du siehst, dreimal. Wenn es fehlerfrei geht, nimm den nächsten Vers dazu.",
      "Slušaj izgrađeno": "Aufgebautes anhören",
      "Dodaj ajet": "Vers hinzufügen",
      "Teži ajeti vraćaju se češće": "Schwerere Verse kommen öfter wieder",
      "Kako ti je išlo?": "Wie ist es dir gegangen?",
      "Ocijeni tek nakon što pokušaš proučiti bez gledanja.":
        "Bewerte erst, nachdem du versucht hast, ohne Hinsehen zu lesen.",
      "Teško": "Schwer",
      "Skoro": "Fast",
      "Znam": "Ich kann es",
      "Slušaj, pa prouči isti ajet bez gledanja": "Hör zu und lies denselben Vers dann ohne Hinsehen",
      "Uči ajet po ajet.": "Lerne Vers für Vers.",
      "Poslušaj tri puta, pa pokušaj sam. Kad ti ide, pređi na sljedeći.":
        "Hör dreimal zu und versuch es dann selbst. Wenn es geht, geh zum nächsten.",
      "Naučen ajet %broj%.": "Vers %broj% gelernt.",
      "Mašallah, cijela sura je naučena!": "Maschallah, die ganze Sure ist gelernt!",
      "Mašallah, proučio si cijelu suru!": "Maschallah, du hast die ganze Sure gelesen!",
      "Recitacija se nije učitala. Provjeri internet.":
        "Die Rezitation wurde nicht geladen. Prüfe deine Internetverbindung.",
      "Arapski tekst se nije učitao. Vježba radi po transkripciji i učaču.":
        "Der arabische Text wurde nicht geladen. Die Übung läuft mit Umschrift und Rezitation weiter.",
      "Broj ajeta se ne poklapa s transkripcijom, pa arapski tekst nije prikazan.":
        "Die Anzahl der Verse stimmt nicht mit der Umschrift überein, darum wird der arabische Text nicht angezeigt.",
      "Za ovu vježbu treba upisati transkripciju, jedan red po ajetu.":
        "Für diese Übung muss die Umschrift eingetragen werden, eine Zeile pro Vers.",
      /* — osmosmjerka — */
      "Osmosmjerka · Mekteb.net": "Buchstabengitter · Mekteb.net",
      "Osmosmjerka": "Buchstabengitter",
      "Mašallah, sve riječi su pronađene!": "Maschallah, alle Wörter sind gefunden!",
      "Pronađeno": "Gefunden",
      "Riječi koje tražiš": "Wörter, die du suchst",
      "Pogodi riječ i pronađi je": "Errate das Wort und finde es",
      "Težina": "Schwierigkeit",
      "Lako": "Leicht",
      "Srednje": "Mittel",
      "Teško": "Schwer",
      "Na spisku prikaži": "In der Liste zeigen",
      "Riječi": "Wörter",
      "Opise": "Beschreibungen",
      "Pokaži prvo slovo": "Ersten Buchstaben zeigen",
      "Mreža slova": "Buchstabengitter",
      "Riječi idu desno i dolje": "Wörter gehen nach rechts und nach unten",
      "Riječi idu desno, dolje i ukoso": "Wörter gehen nach rechts, nach unten und schräg",
      "Svih osam smjerova, i unazad": "Alle acht Richtungen, auch rückwärts",
      "(%broj% slova)": "(%broj% Buchstaben)",
      " (pronađeno)": " (gefunden)",
      "Pronađena riječ: %rijec%. %opis%": "Gefundenes Wort: %rijec%. %opis%",
      "Prvo slovo je u redu %red%, koloni %kolona%.": "Der erste Buchstabe ist in Zeile %red%, Spalte %kolona%.",
      "U podacima nema riječi. Provjeri JSON datoteku.":
        "In den Daten steht kein einziges Wort. Prüfe die JSON-Datei.",
      "Riječi ne staju u mrežu. Smanji broj riječi ili povećaj polje \"velicina\".":
        "Die Wörter passen nicht ins Gitter. Nimm weniger Wörter oder vergrößere das Feld \"velicina\".",

      /* — popuni prazninu — */
      "Popuni prazninu · Mekteb.net": "Lücken füllen · Mekteb.net",
      "Popuni prazninu": "Lücken füllen",
      "Mašallah, sve riječi su na svome mjestu!": "Maschallah, alle Wörter sind an ihrem Platz!",
      "Popunjeno": "Ausgefüllt",
      "Riječi koje nedostaju": "Fehlende Wörter",
      "Sve riječi su iskorištene.": "Alle Wörter sind verbraucht.",
      "Prevuci riječ na prazno mjesto. Kad popuniš sve praznine, klikni „Provjeri\".":
        "Zieh das Wort auf die leere Stelle. Wenn alle Lücken gefüllt sind, klicke auf „Prüfen“.",
      "U podacima nema nijedne praznine. Riječ koja nedostaje piše se u vitičastim zagradama, npr. {abdest}.":
        "In den Daten steht keine einzige Lücke. Ein fehlendes Wort schreibt man in geschweiften Klammern, z. B. {Wudu}.",
      "Praznina %broj% od %ukupno%": "Lücke %broj% von %ukupno%",
      "Praznina %broj%: %rijec%": "Lücke %broj%: %rijec%",
      "Sve praznine su popunjene. Klikni „Provjeri\" da vidiš kako si uradio.":
        "Alle Lücken sind gefüllt. Klicke auf „Prüfen“, um zu sehen, wie du es gemacht hast.",
      "Sve je popunjeno. Klikni Provjeri.": "Alles ist gefüllt. Klicke auf Prüfen.",
      "Smješteno: %rijec%. Ako se predomisliš, dodirni riječ u priči da je vratiš.":
        "Gesetzt: %rijec%. Wenn du es dir anders überlegst, tippe das Wort in der Geschichte an, um es zurückzulegen.",
      "Smješteno. %rijec%": "Gesetzt. %rijec%",
      "Tačno: %broj% od %ukupno%. %dodatak%": "Richtig: %broj% von %ukupno%. %dodatak%",
      "Jedna riječ nije na svome mjestu — dodirni je da je vratiš, pa probaj ponovo.":
        "Ein Wort ist nicht an seinem Platz — tippe es an, um es zurückzulegen, und versuch es noch einmal.",
      "Riječi koje nisu na svome mjestu su označene — dodirni ih da ih vratiš, pa probaj ponovo.":
        "Die Wörter, die nicht an ihrem Platz sind, sind markiert — tippe sie an, um sie zurückzulegen, und versuch es noch einmal.",
      "Tačno %broj% od %ukupno%. Ispravi označene riječi.":
        "Richtig %broj% von %ukupno%. Verbessere die markierten Wörter.",
      "Sada dodirni prazninu u koju ide riječ „%rijec%\".":
        "Tippe jetzt die Lücke an, in die das Wort „%rijec%“ gehört.",
      "Sada odaberi prazninu u koju ide riječ „%rijec%\".":
        "Wähle jetzt die Lücke, in die das Wort „%rijec%“ gehört.",
      "Riječ „%rijec%\" je vraćena među ponuđene.": "Das Wort „%rijec%“ ist zurück bei den angebotenen.",
      "Prvo odaberi riječ sa spiska, pa je smjesti ovdje.":
        "Wähle zuerst ein Wort aus der Liste und setze es dann hierher.",
      "Ovdje ide riječ „%rijec%\".": "Hierher gehört das Wort „%rijec%“.",
      "Pomoć. Ovdje ide %rijec%": "Hilfe. Hierher gehört %rijec%",
      " Iz prve sve na svome mjestu!": " Auf Anhieb alles an seinem Platz!",
      " Jedna riječ je bila na pogrešnom mjestu.": " Ein Wort war am falschen Platz.",
      " Riječi na pogrešnom mjestu: %broj%.": " Wörter am falschen Platz: %broj%.",

      /* — poredak — */
      "Poredak · Mekteb.net": "Reihenfolge · Mekteb.net",
      "Poredak": "Reihenfolge",
      "Mašallah, redoslijed je tačan!": "Maschallah, die Reihenfolge stimmt!",
      "Na mjestu": "Am Platz",
      "Složi stavke od prve do zadnje, pa klikni „Provjeri\".":
        "Ordne die Einträge vom ersten bis zum letzten und klicke dann auf „Prüfen“.",
      "Za ovu vježbu trebaju najmanje dvije stavke. Stavke se pišu u polju „stavke\", tačnim redoslijedom.":
        "Für diese Übung braucht es mindestens zwei Einträge. Die Einträge stehen im Feld „stavke“, in der richtigen Reihenfolge.",
      "%broj%. %tekst%": "%broj%. %tekst%",
      "%broj%. %tekst% — na svome mjestu": "%broj%. %tekst% — am richtigen Platz",
      "Pomjeri gore: %tekst%": "Nach oben schieben: %tekst%",
      "Pomjeri dolje: %tekst%": "Nach unten schieben: %tekst%",
      "Zamijenjeno: „%a%\" i „%b%\".": "Getauscht: „%a%“ und „%b%“.",
      "Zamijenjeno.": "Getauscht.",
      "Na svome mjestu: %broj% od %ukupno%. Označene stavke još nisu na svome mjestu — zamijeni im mjesta pa provjeri ponovo.":
        "Am richtigen Platz: %broj% von %ukupno%. Die markierten Einträge stehen noch nicht richtig — tausche ihre Plätze und prüfe noch einmal.",
      "Na svome mjestu %broj% od %ukupno%.": "Am richtigen Platz %broj% von %ukupno%.",
      "Sada dodirni stavku s kojom mijenja mjesto.": "Tippe jetzt den Eintrag an, mit dem er den Platz tauscht.",
      "Sada odaberi stavku s kojom mijenja mjesto.": "Wähle jetzt den Eintrag, mit dem er den Platz tauscht.",
      "Ovdje ide: „%tekst%\".": "Hierher gehört: „%tekst%“.",
      "Pomoć. Ovdje ide %tekst%": "Hilfe. Hierher gehört %tekst%",
      " Iz prve na mjestu: %broj% od %ukupno%.": " Auf Anhieb am Platz: %broj% von %ukupno%.",

      /* — razvrstaj — */
      "Razvrstaj · Mekteb.net": "Sortieren · Mekteb.net",
      "Razvrstaj": "Sortieren",
      "Mašallah, sve je razvrstano kako treba!": "Maschallah, alles ist richtig sortiert!",
      "Razvrstano": "Sortiert",
      "Stavke za razvrstavanje": "Einträge zum Sortieren",
      "Sve stavke su razvrstane.": "Alle Einträge sind sortiert.",
      "Prevuci svaku stavku u kutiju kojoj pripada, pa klikni „Provjeri\".":
        "Zieh jeden Eintrag in die Kiste, in die er gehört, und klicke dann auf „Prüfen“.",
      "Za ovu vježbu trebaju najmanje dvije kutije, svaka sa bar jednom stavkom.":
        "Für diese Übung braucht es mindestens zwei Kisten, jede mit mindestens einem Eintrag.",
      "Kutija %naziv% — ovdje smjesti izabranu stavku": "Kiste %naziv% — setze hier den gewählten Eintrag ab",
      "Sve je razvrstano. Klikni „Provjeri\" da vidiš kako si uradio.":
        "Alles ist sortiert. Klicke auf „Prüfen“, um zu sehen, wie du es gemacht hast.",
      "Sve je razvrstano. Klikni Provjeri.": "Alles ist sortiert. Klicke auf Prüfen.",
      "Smješteno: %tekst% → %kutija%.": "Gesetzt: %tekst% → %kutija%.",
      "Smješteno u %kutija%": "Gesetzt in %kutija%",
      "Stavka „%tekst%\" je vraćena među ponuđene.": "Der Eintrag „%tekst%“ ist zurück bei den angebotenen.",
      "Tačno razvrstano: %broj% od %ukupno%. Označene stavke nisu u pravoj kutiji — dodirni ih da ih vratiš, pa probaj ponovo.":
        "Richtig sortiert: %broj% von %ukupno%. Die markierten Einträge sind nicht in der richtigen Kiste — tippe sie an, um sie zurückzulegen, und versuch es noch einmal.",
      "Tačno %broj% od %ukupno%. Ispravi označene stavke.":
        "Richtig %broj% von %ukupno%. Verbessere die markierten Einträge.",
      "Sada dodirni kutiju u koju ide „%tekst%\".": "Tippe jetzt die Kiste an, in die „%tekst%“ gehört.",
      "Sada odaberi kutiju u koju ide „%tekst%\".": "Wähle jetzt die Kiste, in die „%tekst%“ gehört.",
      "Prvo odaberi stavku, pa je smjesti u kutiju.": "Wähle zuerst einen Eintrag und setze ihn dann in eine Kiste.",
      "„%tekst%\" ide u kutiju %kutija%.": "„%tekst%“ gehört in die Kiste %kutija%.",
      "Pomoć. %tekst% ide u %kutija%": "Hilfe. %tekst% gehört in %kutija%",

      /* — spoji parove — */
      "Spoji parove · Mekteb.net": "Paare verbinden · Mekteb.net",
      "Spoji parove": "Paare verbinden",
      "Mašallah, svi parovi su tačni!": "Maschallah, alle Paare stimmen!",
      "Spojeno": "Verbunden",
      "Odgovori": "Antworten",
      "Svi odgovori su iskorišteni.": "Alle Antworten sind verbraucht.",
      "Ovdje ide odgovor": "Hierher gehört die Antwort",
      "Prevuci odgovor uz pojam kojem pripada, pa klikni „Provjeri\".":
        "Zieh die Antwort zu dem Begriff, zu dem sie gehört, und klicke dann auf „Prüfen“.",
      "Za ovu vježbu trebaju najmanje dva para. Par se piše kao „lijevo\" i „desno\".":
        "Für diese Übung braucht es mindestens zwei Paare. Ein Paar schreibt man als „lijevo“ und „desno“.",
      "%pojam%: %odgovor%": "%pojam%: %odgovor%",
      "%pojam% — ovdje smjesti odgovor": "%pojam% — setze hier die Antwort ab",
      "Svi parovi su spojeni. Klikni „Provjeri\" da vidiš kako si uradio.":
        "Alle Paare sind verbunden. Klicke auf „Prüfen“, um zu sehen, wie du es gemacht hast.",
      "Sve je spojeno. Klikni Provjeri.": "Alles ist verbunden. Klicke auf Prüfen.",
      "Spojeno: %pojam% → %odgovor%.": "Verbunden: %pojam% → %odgovor%.",
      "Spojeno. %pojam% i %odgovor%": "Verbunden. %pojam% und %odgovor%",
      "Odgovor „%odgovor%\" je vraćen među ponuđene.": "Die Antwort „%odgovor%“ ist zurück bei den angebotenen.",
      "Tačnih parova: %broj% od %ukupno%. Označeni odgovori nisu uz svoj pojam — dodirni ih da ih vratiš, pa probaj ponovo.":
        "Richtige Paare: %broj% von %ukupno%. Die markierten Antworten stehen nicht bei ihrem Begriff — tippe sie an, um sie zurückzulegen, und versuch es noch einmal.",
      "Tačno %broj% od %ukupno%. Ispravi označene.": "Richtig %broj% von %ukupno%. Verbessere die markierten.",
      "Sada dodirni pojam uz koji ide „%odgovor%\".": "Tippe jetzt den Begriff an, zu dem „%odgovor%“ gehört.",
      "Sada odaberi pojam uz koji ide „%odgovor%\".": "Wähle jetzt den Begriff, zu dem „%odgovor%“ gehört.",
      "Prvo odaberi odgovor, pa ga smjesti uz pojam.": "Wähle zuerst eine Antwort und setze sie dann zum Begriff.",
      "Uz „%pojam%\" ide „%odgovor%\".": "Zu „%pojam%“ gehört „%odgovor%“.",
      "Pomoć. %pojam% ide sa %odgovor%": "Hilfe. %pojam% gehört zu %odgovor%",
      " Iz prve svi parovi tačni!": " Auf Anhieb alle Paare richtig!",

      /* — upiši odgovor — */
      "Upiši odgovor · Mekteb.net": "Antwort schreiben · Mekteb.net",
      "Upiši odgovor": "Antwort schreiben",
      "Mašallah, svi odgovori su tačni!": "Maschallah, alle Antworten stimmen!",
      "Tačno": "Richtig",
      "Upiši odgovor ispod svakog pitanja, pa klikni „Provjeri\".":
        "Schreibe die Antwort unter jede Frage und klicke dann auf „Prüfen“.",
      "U podacima nema nijednog pitanja. Svako pitanje treba i pitanje i odgovor.":
        "In den Daten steht keine einzige Frage. Jede Frage braucht Frage und Antwort.",
      "Odgovor na pitanje %broj%: %pitanje%": "Antwort auf Frage %broj%: %pitanje%",
      "Tačno! Pazi samo kako se piše: %odgovor%": "Richtig! Achte nur auf die Schreibweise: %odgovor%",
      "Tačnih odgovora: %broj% od %ukupno%. Označena pitanja probaj ponovo — ispravi odgovor pa klikni „Provjeri\".":
        "Richtige Antworten: %broj% von %ukupno%. Versuche die markierten Fragen noch einmal — verbessere die Antwort und klicke auf „Prüfen“.",
      "Tačno %broj% od %ukupno%. Ispravi označena pitanja.":
        "Richtig %broj% von %ukupno%. Verbessere die markierten Fragen.",
      "Odgovor je upisan kao pomoć.": "Die Antwort wurde als Hilfe eingetragen.",
      "Odgovor na %broj%. pitanje je: %odgovor%": "Die Antwort auf Frage %broj% ist: %odgovor%",
      "Pomoć. Odgovor je %odgovor%": "Hilfe. Die Antwort ist %odgovor%",
      " Iz prve svi odgovori tačni!": " Auf Anhieb alle Antworten richtig!"
    },

    en: {
      /* — zajedničko — */
      "Mekteb.net · vježba": "Mekteb.net · exercise",
      "Vrijeme": "Time",
      "Vrijeme: %vrijeme%.": "Time: %vrijeme%.",
      "Vrijeme: %vrijeme%. %pomoc%": "Time: %vrijeme%. %pomoc%",
      "%broj% od %ukupno%": "%broj% of %ukupno%",
      "0 od 0": "0 of 0",
      "Provjeri": "Check",
      "Pomozi mi": "Help me",
      "Počni ispočetka": "Start over",
      "Pokušaj ponovo": "Try again",
      "Igraj ponovo": "Play again",
      "Nova igra": "New game",
      "Za ovu vježbu treba uključiti JavaScript.": "JavaScript must be turned on for this exercise.",
      "Bez pomoći.": "No help used.",
      " Pomoć korištena jednom.": " Help used once.",
      "Pomoć korištena jednom.": "Help used once.",
      " Pomoć korištena %broj% puta.": " Help used %broj% times.",
      "Pomoć korištena %broj% puta.": "Help used %broj% times.",
      " Iz prve tačno: %broj% od %ukupno%.": " Right the first time: %broj% of %ukupno%.",
      " Iz prve sve tačno!": " All right the first time!",
      "Vraćeno. %tekst%": "Put back. %tekst%",
      "Prazno": "Empty",

      /* — nauči napamet — */
      "Nauči napamet · Mekteb.net": "Learn by heart · Mekteb.net",
      "Nauči napamet": "Learn by heart",
      "Ajet": "Verse",
      "Naučeno": "Learned",
      "Prati": "Follow",
      "Gradi suru": "Build the surah",
      "Ponavljaj": "Review",
      "Slušaj ajet": "Listen to the verse",
      "Ponovi 3×": "Repeat 3×",
      "Prethodni": "Previous",
      "Sljedeći": "Next",
      "Cijela sura": "Whole surah",
      "1. ajet → 1+2 → cijela sura": "verse 1 → 1+2 → whole surah",
      "Korak %broj% od %ukupno%": "Step %broj% of %ukupno%",
      "Prouči sve što vidiš tri puta. Kad ti ide bez greške, dodaj sljedeći ajet.":
        "Recite everything you see three times. When it goes without a mistake, add the next verse.",
      "Slušaj izgrađeno": "Listen to what you built",
      "Dodaj ajet": "Add a verse",
      "Teži ajeti vraćaju se češće": "Harder verses come back more often",
      "Kako ti je išlo?": "How did it go?",
      "Ocijeni tek nakon što pokušaš proučiti bez gledanja.":
        "Rate it only after you try reciting without looking.",
      "Teško": "Hard",
      "Skoro": "Almost",
      "Znam": "I know it",
      "Slušaj, pa prouči isti ajet bez gledanja": "Listen, then recite the same verse without looking",
      "Uči ajet po ajet.": "Learn verse by verse.",
      "Poslušaj tri puta, pa pokušaj sam. Kad ti ide, pređi na sljedeći.":
        "Listen three times, then try on your own. When it goes, move to the next one.",
      "Naučen ajet %broj%.": "Verse %broj% learned.",
      "Mašallah, cijela sura je naučena!": "Mashallah, the whole surah is learned!",
      "Mašallah, proučio si cijelu suru!": "Mashallah, you recited the whole surah!",
      "Recitacija se nije učitala. Provjeri internet.":
        "The recitation did not load. Check your internet connection.",
      "Arapski tekst se nije učitao. Vježba radi po transkripciji i učaču.":
        "The Arabic text did not load. The exercise continues with the transcription and the reciter.",
      "Broj ajeta se ne poklapa s transkripcijom, pa arapski tekst nije prikazan.":
        "The number of verses does not match the transcription, so the Arabic text is not shown.",
      "Za ovu vježbu treba upisati transkripciju, jedan red po ajetu.":
        "This exercise needs a transcription, one line per verse.",
      /* — osmosmjerka — */
      "Osmosmjerka · Mekteb.net": "Word search · Mekteb.net",
      "Osmosmjerka": "Word search",
      "Mašallah, sve riječi su pronađene!": "Mashallah, you found every word!",
      "Pronađeno": "Found",
      "Riječi koje tražiš": "Words you are looking for",
      "Pogodi riječ i pronađi je": "Guess the word and find it",
      "Težina": "Difficulty",
      "Lako": "Easy",
      "Srednje": "Medium",
      "Teško": "Hard",
      "Na spisku prikaži": "Show in the list",
      "Riječi": "Words",
      "Opise": "Descriptions",
      "Pokaži prvo slovo": "Show the first letter",
      "Mreža slova": "Letter grid",
      "Riječi idu desno i dolje": "Words go right and down",
      "Riječi idu desno, dolje i ukoso": "Words go right, down and diagonally",
      "Svih osam smjerova, i unazad": "All eight directions, and backwards",
      "(%broj% slova)": "(%broj% letters)",
      " (pronađeno)": " (found)",
      "Pronađena riječ: %rijec%. %opis%": "Word found: %rijec%. %opis%",
      "Prvo slovo je u redu %red%, koloni %kolona%.": "The first letter is in row %red%, column %kolona%.",
      "U podacima nema riječi. Provjeri JSON datoteku.": "The data has no words at all. Check the JSON file.",
      "Riječi ne staju u mrežu. Smanji broj riječi ili povećaj polje \"velicina\".":
        "The words do not fit in the grid. Use fewer words or increase the \"velicina\" field.",

      /* — popuni prazninu — */
      "Popuni prazninu · Mekteb.net": "Fill the gap · Mekteb.net",
      "Popuni prazninu": "Fill the gap",
      "Mašallah, sve riječi su na svome mjestu!": "Mashallah, every word is in its place!",
      "Popunjeno": "Filled",
      "Riječi koje nedostaju": "Missing words",
      "Sve riječi su iskorištene.": "All the words have been used.",
      "Prevuci riječ na prazno mjesto. Kad popuniš sve praznine, klikni „Provjeri\".":
        "Drag the word onto the empty space. When every gap is filled, click „Check“.",
      "U podacima nema nijedne praznine. Riječ koja nedostaje piše se u vitičastim zagradama, npr. {abdest}.":
        "The data has no gaps at all. A missing word is written in curly brackets, e.g. {wudu}.",
      "Praznina %broj% od %ukupno%": "Gap %broj% of %ukupno%",
      "Praznina %broj%: %rijec%": "Gap %broj%: %rijec%",
      "Sve praznine su popunjene. Klikni „Provjeri\" da vidiš kako si uradio.":
        "Every gap is filled. Click „Check“ to see how you did.",
      "Sve je popunjeno. Klikni Provjeri.": "Everything is filled. Click Check.",
      "Smješteno: %rijec%. Ako se predomisliš, dodirni riječ u priči da je vratiš.":
        "Placed: %rijec%. If you change your mind, tap the word in the story to take it back.",
      "Smješteno. %rijec%": "Placed. %rijec%",
      "Tačno: %broj% od %ukupno%. %dodatak%": "Correct: %broj% of %ukupno%. %dodatak%",
      "Jedna riječ nije na svome mjestu — dodirni je da je vratiš, pa probaj ponovo.":
        "One word is not in its place — tap it to take it back, then try again.",
      "Riječi koje nisu na svome mjestu su označene — dodirni ih da ih vratiš, pa probaj ponovo.":
        "The words that are not in their place are marked — tap them to take them back, then try again.",
      "Tačno %broj% od %ukupno%. Ispravi označene riječi.":
        "Correct %broj% of %ukupno%. Fix the marked words.",
      "Sada dodirni prazninu u koju ide riječ „%rijec%\".":
        "Now tap the gap where the word „%rijec%“ goes.",
      "Sada odaberi prazninu u koju ide riječ „%rijec%\".":
        "Now choose the gap where the word „%rijec%“ goes.",
      "Riječ „%rijec%\" je vraćena među ponuđene.": "The word „%rijec%“ is back among the offered ones.",
      "Prvo odaberi riječ sa spiska, pa je smjesti ovdje.":
        "First choose a word from the list, then place it here.",
      "Ovdje ide riječ „%rijec%\".": "The word „%rijec%“ goes here.",
      "Pomoć. Ovdje ide %rijec%": "Help. %rijec% goes here",
      " Iz prve sve na svome mjestu!": " All in place the first time!",
      " Jedna riječ je bila na pogrešnom mjestu.": " One word was in the wrong place.",
      " Riječi na pogrešnom mjestu: %broj%.": " Words in the wrong place: %broj%.",

      /* — poredak — */
      "Poredak · Mekteb.net": "Put in order · Mekteb.net",
      "Poredak": "Put in order",
      "Mašallah, redoslijed je tačan!": "Mashallah, the order is right!",
      "Na mjestu": "In place",
      "Složi stavke od prve do zadnje, pa klikni „Provjeri\".":
        "Put the items in order from first to last, then click „Check“.",
      "Za ovu vježbu trebaju najmanje dvije stavke. Stavke se pišu u polju „stavke\", tačnim redoslijedom.":
        "This exercise needs at least two items. The items go in the „stavke“ field, in the right order.",
      "%broj%. %tekst%": "%broj%. %tekst%",
      "%broj%. %tekst% — na svome mjestu": "%broj%. %tekst% — in its place",
      "Pomjeri gore: %tekst%": "Move up: %tekst%",
      "Pomjeri dolje: %tekst%": "Move down: %tekst%",
      "Zamijenjeno: „%a%\" i „%b%\".": "Swapped: „%a%“ and „%b%“.",
      "Zamijenjeno.": "Swapped.",
      "Na svome mjestu: %broj% od %ukupno%. Označene stavke još nisu na svome mjestu — zamijeni im mjesta pa provjeri ponovo.":
        "In place: %broj% of %ukupno%. The marked items are not in place yet — swap them, then check again.",
      "Na svome mjestu %broj% od %ukupno%.": "In place %broj% of %ukupno%.",
      "Sada dodirni stavku s kojom mijenja mjesto.": "Now tap the item it should swap places with.",
      "Sada odaberi stavku s kojom mijenja mjesto.": "Now choose the item it should swap places with.",
      "Ovdje ide: „%tekst%\".": "„%tekst%“ goes here.",
      "Pomoć. Ovdje ide %tekst%": "Help. %tekst% goes here",
      " Iz prve na mjestu: %broj% od %ukupno%.": " In place the first time: %broj% of %ukupno%.",

      /* — razvrstaj — */
      "Razvrstaj · Mekteb.net": "Sort it · Mekteb.net",
      "Razvrstaj": "Sort it",
      "Mašallah, sve je razvrstano kako treba!": "Mashallah, everything is sorted the right way!",
      "Razvrstano": "Sorted",
      "Stavke za razvrstavanje": "Items to sort",
      "Sve stavke su razvrstane.": "Every item has been sorted.",
      "Prevuci svaku stavku u kutiju kojoj pripada, pa klikni „Provjeri\".":
        "Drag each item into the box it belongs to, then click „Check“.",
      "Za ovu vježbu trebaju najmanje dvije kutije, svaka sa bar jednom stavkom.":
        "This exercise needs at least two boxes, each with at least one item.",
      "Kutija %naziv% — ovdje smjesti izabranu stavku": "Box %naziv% — place the chosen item here",
      "Sve je razvrstano. Klikni „Provjeri\" da vidiš kako si uradio.":
        "Everything is sorted. Click „Check“ to see how you did.",
      "Sve je razvrstano. Klikni Provjeri.": "Everything is sorted. Click Check.",
      "Smješteno: %tekst% → %kutija%.": "Placed: %tekst% → %kutija%.",
      "Smješteno u %kutija%": "Placed in %kutija%",
      "Stavka „%tekst%\" je vraćena među ponuđene.": "The item „%tekst%“ is back among the offered ones.",
      "Tačno razvrstano: %broj% od %ukupno%. Označene stavke nisu u pravoj kutiji — dodirni ih da ih vratiš, pa probaj ponovo.":
        "Sorted correctly: %broj% of %ukupno%. The marked items are not in the right box — tap them to take them back, then try again.",
      "Tačno %broj% od %ukupno%. Ispravi označene stavke.":
        "Correct %broj% of %ukupno%. Fix the marked items.",
      "Sada dodirni kutiju u koju ide „%tekst%\".": "Now tap the box where „%tekst%“ goes.",
      "Sada odaberi kutiju u koju ide „%tekst%\".": "Now choose the box where „%tekst%“ goes.",
      "Prvo odaberi stavku, pa je smjesti u kutiju.": "First choose an item, then place it in a box.",
      "„%tekst%\" ide u kutiju %kutija%.": "„%tekst%“ goes in the box %kutija%.",
      "Pomoć. %tekst% ide u %kutija%": "Help. %tekst% goes in %kutija%",

      /* — spoji parove — */
      "Spoji parove · Mekteb.net": "Match the pairs · Mekteb.net",
      "Spoji parove": "Match the pairs",
      "Mašallah, svi parovi su tačni!": "Mashallah, every pair is right!",
      "Spojeno": "Matched",
      "Odgovori": "Answers",
      "Svi odgovori su iskorišteni.": "All the answers have been used.",
      "Ovdje ide odgovor": "The answer goes here",
      "Prevuci odgovor uz pojam kojem pripada, pa klikni „Provjeri\".":
        "Drag the answer to the term it belongs to, then click „Check“.",
      "Za ovu vježbu trebaju najmanje dva para. Par se piše kao „lijevo\" i „desno\".":
        "This exercise needs at least two pairs. A pair is written as „lijevo“ and „desno“.",
      "%pojam%: %odgovor%": "%pojam%: %odgovor%",
      "%pojam% — ovdje smjesti odgovor": "%pojam% — place the answer here",
      "Svi parovi su spojeni. Klikni „Provjeri\" da vidiš kako si uradio.":
        "Every pair is matched. Click „Check“ to see how you did.",
      "Sve je spojeno. Klikni Provjeri.": "Everything is matched. Click Check.",
      "Spojeno: %pojam% → %odgovor%.": "Matched: %pojam% → %odgovor%.",
      "Spojeno. %pojam% i %odgovor%": "Matched. %pojam% and %odgovor%",
      "Odgovor „%odgovor%\" je vraćen među ponuđene.": "The answer „%odgovor%“ is back among the offered ones.",
      "Tačnih parova: %broj% od %ukupno%. Označeni odgovori nisu uz svoj pojam — dodirni ih da ih vratiš, pa probaj ponovo.":
        "Correct pairs: %broj% of %ukupno%. The marked answers are not with their term — tap them to take them back, then try again.",
      "Tačno %broj% od %ukupno%. Ispravi označene.": "Correct %broj% of %ukupno%. Fix the marked ones.",
      "Sada dodirni pojam uz koji ide „%odgovor%\".": "Now tap the term that „%odgovor%“ goes with.",
      "Sada odaberi pojam uz koji ide „%odgovor%\".": "Now choose the term that „%odgovor%“ goes with.",
      "Prvo odaberi odgovor, pa ga smjesti uz pojam.": "First choose an answer, then place it with a term.",
      "Uz „%pojam%\" ide „%odgovor%\".": "„%odgovor%“ goes with „%pojam%“.",
      "Pomoć. %pojam% ide sa %odgovor%": "Help. %pojam% goes with %odgovor%",
      " Iz prve svi parovi tačni!": " Every pair right the first time!",

      /* — upiši odgovor — */
      "Upiši odgovor · Mekteb.net": "Write the answer · Mekteb.net",
      "Upiši odgovor": "Write the answer",
      "Mašallah, svi odgovori su tačni!": "Mashallah, every answer is right!",
      "Tačno": "Correct",
      "Upiši odgovor ispod svakog pitanja, pa klikni „Provjeri\".":
        "Write the answer under each question, then click „Check“.",
      "U podacima nema nijednog pitanja. Svako pitanje treba i pitanje i odgovor.":
        "The data has no questions at all. Every question needs a question and an answer.",
      "Odgovor na pitanje %broj%: %pitanje%": "Answer to question %broj%: %pitanje%",
      "Tačno! Pazi samo kako se piše: %odgovor%": "Correct! Just watch the spelling: %odgovor%",
      "Tačnih odgovora: %broj% od %ukupno%. Označena pitanja probaj ponovo — ispravi odgovor pa klikni „Provjeri\".":
        "Correct answers: %broj% of %ukupno%. Try the marked questions again — fix the answer and click „Check“.",
      "Tačno %broj% od %ukupno%. Ispravi označena pitanja.":
        "Correct %broj% of %ukupno%. Fix the marked questions.",
      "Odgovor je upisan kao pomoć.": "The answer has been written in as help.",
      "Odgovor na %broj%. pitanje je: %odgovor%": "The answer to question %broj% is: %odgovor%",
      "Pomoć. Odgovor je %odgovor%": "Help. The answer is %odgovor%",
      " Iz prve svi odgovori tačni!": " Every answer right the first time!"
    }
  };

  var jezik = "bs";
  try {
    var trazeni = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(RJECNIK, trazeni)) jezik = trazeni;
  } catch (g) { /* stari preglednik — ostaje bosanski */ }

  var rjecnik = RJECNIK[jezik] || null;

  function t(kljuc, zamjene) {
    var tekst = (rjecnik && rjecnik[kljuc]) || kljuc;
    if (!zamjene) return tekst;
    return tekst.replace(/%([a-zA-Z]+)%/g, function (cijelo, ime) {
      return Object.prototype.hasOwnProperty.call(zamjene, ime) ? String(zamjene[ime]) : cijelo;
    });
  }

  /**
   * Prevedi statički tekst na stranici. Poziva se odmah, dok je u DOM-u samo
   * ono što piše u HTML-u vježbe — sadržaj vježbe dolazi tek poslije, kroz
   * `T(...)`, pa ga ovaj prolaz nikad ne dotakne.
   */
  function prevediStatiku() {
    if (!rjecnik) return;
    if (document.title && rjecnik[document.title]) document.title = rjecnik[document.title];
    var hodac = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var cvor;
    while ((cvor = hodac.nextNode())) {
      var sirovo = cvor.nodeValue;
      var jezgro = sirovo.trim();
      if (!jezgro || !rjecnik[jezgro]) continue;
      cvor.nodeValue = sirovo.replace(jezgro, rjecnik[jezgro]);
    }
    var atributi = ["aria-label", "placeholder", "title", "alt"];
    var svi = document.body.querySelectorAll("[aria-label],[placeholder],[title],[alt]");
    for (var i = 0; i < svi.length; i++) {
      for (var a = 0; a < atributi.length; a++) {
        var v = svi[i].getAttribute(atributi[a]);
        if (v && rjecnik[v.trim()]) svi[i].setAttribute(atributi[a], rjecnik[v.trim()]);
      }
    }
  }

  /**
   * Dopiši jezik na adresu s koje vježba čita svoj sadržaj. API vraća prevedeni
   * sadržaj samo ako mu jezik stigne kroz upit — iframe ne može poslati
   * `X-Lang` zaglavlje. Na bosanskom se adresa ne dira.
   */
  function saJezikom(adresa) {
    var a = String(adresa || "");
    if (!a || jezik === "bs" || /[?&]lang=/.test(a)) return a;
    return a + (a.indexOf("?") > -1 ? "&" : "?") + "lang=" + encodeURIComponent(jezik);
  }

  /** Ima li rječnik ovaj ključ? Koristi test koji pazi da nijedan ne izostane. */
  function ima(kljuc) {
    return !!rjecnik && Object.prototype.hasOwnProperty.call(rjecnik, kljuc);
  }

  global.MektebJezik = { jezik: jezik, t: t, ima: ima, saJezikom: saJezikom };
  if (document.body) prevediStatiku();
  else document.addEventListener("DOMContentLoaded", prevediStatiku);
})(window);
