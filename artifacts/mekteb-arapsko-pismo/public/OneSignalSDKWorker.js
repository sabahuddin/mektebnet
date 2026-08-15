importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Badge na PWA ikoni — postavi kad dođe push, skini kad korisnik klikne.
// Badging API podržava Chrome/Edge na desktopu i Androidu (iOS Safari 16.4+
// podržava setAppBadge ali ne podržava web push — pa badge radi samo kad je
// app otvorena, iz glavne niti).

self.addEventListener("push", function () {
  // Inkrementiraj badge bez broja (prikazuje točku/oznaku).
  // Broj se ažurira kad se app otvori (iz use-unread-poruke hook-a).
  if ("setAppBadge" in self.navigator) {
    self.navigator.setAppBadge().catch(function () {});
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
