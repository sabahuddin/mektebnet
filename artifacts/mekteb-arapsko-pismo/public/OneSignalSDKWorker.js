// Badge na PWA ikoni — postavi kad dođe push, skini kad korisnik klikne.
// Badging API podržava Chrome/Edge na desktopu i Androidu (iOS Safari 16.4+
// podržava setAppBadge ali ne podržava web push — pa badge radi samo kad je
// app otvorena, iz glavne niti).

self.addEventListener("push", function () {
  // Postavi badge na 1 kad dođe push. iOS traži eksplicitni broj (ne "flag"
  // mode bez argumenta) da prikaže crvenu značku na ikoni. Točan broj
  // nepročitanih poruka hook postavi kad se app otvori.
  if ("setAppBadge" in self.navigator) {
    self.navigator.setAppBadge(1).catch(function () {});
  }
  // Daljnju obradu (prikaz notifikacije) preuzima OneSignal SDK.
});

self.addEventListener("notificationclick", function () {
  // Korisnik je kliknuo na notifikaciju — skini badge.
  // Kad se app otvori, hook će postaviti tačan broj nepročitanih.
  if ("clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge().catch(function () {});
  }
  // Otvaranje URL-a i fokusiranje prozora preuzima OneSignal.
});

// Učitaj OneSignal TEK nakon naših listenera. SDK može zaustaviti propagaciju
// push eventa; ako se importuje prvi, naš badge listener se nikad ne izvrši.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
