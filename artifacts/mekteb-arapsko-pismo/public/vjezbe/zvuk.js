/**
 * Diskretni zvukovi naših vježbi.
 *
 * Tonovi se prave u pregledniku (Web Audio), pa nema nijedne zvučne datoteke
 * ni ijednog zahtjeva prema vanjskoj domeni. Zvuk je kratak i tih — vježba se
 * često rješava u mektebu, gdje je dvadesetero djece u istoj prostoriji.
 *
 * Poštuje postavke platforme (vježba je na istoj domeni, pa čita iste ključeve):
 *   mekteb-audio-muted           – zvučnik u zaglavlju platforme
 *   mekteb:soundEffectsEnabled   – „zvučni efekti" u profilu učenika
 * Roditeljska stranica može zvuk ugasiti i adresom: ?zvuk=ne
 *
 * Preglednici ne daju zvuk dok dijete nešto ne dodirne, pa se zvučni sistem
 * budi pri prvom dodiru ili tipki.
 */
(function () {
  'use strict';

  var kontekst = null;
  var probudjen = false;

  function ugasen() {
    try {
      if (new URLSearchParams(location.search).get('zvuk') === 'ne') return true;
    } catch (g) { /* stara adresa — ne smeta */ }
    try {
      if (localStorage.getItem('mekteb-audio-muted') === 'true') return true;
      if (localStorage.getItem('mekteb:soundEffectsEnabled') === 'false') return true;
    } catch (g) {
      // Blokiran localStorage (privatni prozor) — pustimo zvuk, tih je.
    }
    return false;
  }

  function dohvati() {
    var Klasa = window.AudioContext || window.webkitAudioContext;
    if (!Klasa) return null;
    if (!kontekst) {
      try { kontekst = new Klasa(); } catch (g) { return null; }
    }
    if (kontekst.state === 'suspended' && kontekst.resume) {
      try { kontekst.resume(); } catch (g) { /* probat ćemo sljedeći put */ }
    }
    return kontekst;
  }

  /** Jedan mekan ton: bez naglog početka i kraja, da ne „pukne". */
  function ton(frekvencija, pocetak, trajanje, jacina) {
    var k = dohvati();
    if (!k) return;
    var kad = k.currentTime + pocetak;
    var oscilator = k.createOscillator();
    var pojacalo = k.createGain();
    oscilator.type = 'sine';
    oscilator.frequency.setValueAtTime(frekvencija, kad);
    pojacalo.gain.setValueAtTime(0.0001, kad);
    pojacalo.gain.exponentialRampToValueAtTime(jacina, kad + 0.02);
    pojacalo.gain.exponentialRampToValueAtTime(0.0001, kad + trajanje);
    oscilator.connect(pojacalo);
    pojacalo.connect(k.destination);
    oscilator.start(kad);
    oscilator.stop(kad + trajanje + 0.02);
  }

  function sviraj(note) {
    if (ugasen() || !probudjen) return;
    try {
      note.forEach(function (n) { ton(n[0], n[1], n[2], n[3]); });
    } catch (g) {
      // Zvuk nikad ne smije srušiti vježbu.
    }
  }

  var MektebZvuk = {
    /** Kratak, jedva čujan „tik" — jedna stavka je tačna. */
    tacno: function () { sviraj([[880, 0, 0.09, 0.05]]); },
    /** Mekan niski ton — ima šta popraviti. Namjerno tiši od tačnog. */
    greska: function () { sviraj([[196, 0, 0.16, 0.035]]); },
    /** Tri note naviše — vježba je riješena. */
    kraj: function () {
      sviraj([[587.33, 0, 0.16, 0.07], [783.99, 0.12, 0.16, 0.07], [987.77, 0.24, 0.3, 0.075]]);
    },
    /** Je li zvuk trenutno ugašen (za provjere i za buduću upotrebu). */
    ugasen: ugasen
  };

  // Zvučni sistem se budi tek kad dijete nešto dodirne ili pritisne tipku.
  function probudi() {
    probudjen = true;
    if (!ugasen()) dohvati();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (dogadjaj) {
    document.addEventListener(dogadjaj, probudi, { once: true, passive: true });
  });

  window.MektebZvuk = MektebZvuk;
})();
