# Mekteb Mobile Build (iOS + Android)

Web app je upakovan kao native mobile app preko **Capacitor**. Bundle ID:
`net.mektebnet.app` (Mekteb).

## Arhitektura

```
┌──────────────────────────────────────────────────────────┐
│  iOS / Android native shell (Capacitor)                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ WebView (učitava bundled dist/public/index.html)   │  │
│  │   ├─ React app                                     │  │
│  │   ├─ Service Worker (PWA cache)                    │  │
│  │   └─ fetch("https://mekteb.net/api/...")           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
              https://mekteb.net/api  ← backend (Coolify)
              CORS allow: capacitor://localhost (iOS),
                          https://localhost (Android)
```

- **Web bundle je BAKED-IN** u native app (`webDir: "dist/public"`). Ne učitava
  se sa servera. App radi 100% offline od starta. Apple App Store traži ovo
  (ne primaju "samo wrapper za mekteb.net").
- **API pozivi idu uvijek na produkciju** (`VITE_API_BASE_URL=https://mekteb.net/api`),
  baked-in pri buildu. Ne ovisi o relativnoj putanji.
- **Native OneSignal App ID ide u bundle pri buildu** preko
  `VITE_ONESIGNAL_APP_ID` (ili `ONESIGNAL_APP_ID`). Sama vrijednost ne ide u Git.
- **PWA Service Worker** unutar webview-a je drugi sloj offline-a — runtime
  cache za public sadržaj (ilmihal, kvizovi, knjige, rječnik).

## Prvi setup (jednom, na iMac-u)

Treba ti:
- macOS sa Xcode 15+ (App Store)
- Android Studio (https://developer.android.com/studio)
- Java JDK 17 (Android Studio ima built-in)
- Apple Developer Account (potvrđeno: imaš)
- Cocoapods: `sudo gem install cocoapods`

Klonaj repo i instaliraj:
```bash
git clone <repo-url>
cd mektebnet-monorepo
pnpm install
```

Native projekti **već postoje** u repo-u (`artifacts/mekteb-arapsko-pismo/ios`
i `.../android`) — ne treba `cap add` ponovo. Android se može odmah
sinhronizirati. iOS OneSignal zahtijeva zasebnu migraciju na CocoaPods
(objašnjenje u odjeljku za push) prije prvog native sync-a.

## Build cycle (svaki put kad praviš novu mobilnu verziju)

Iz root-a monorepoa:

```bash
# 1. Build web bundle sa produkcijskim API URL-om
pnpm --filter @workspace/mekteb-arapsko-pismo run build:mobile

# 2. Provjeri native konfiguraciju i bundle bez ispisa ključeva
pnpm --filter @workspace/mekteb-arapsko-pismo run mobile:verify

# 3. Android sync — kopira dist/public i ažurira OneSignal plugin
pnpm --filter @workspace/mekteb-arapsko-pismo exec cap sync android

# iOS sync radi nakon CocoaPods migracije opisane niže.
```

### Otvori u Xcode (iOS)
```bash
pnpm --filter @workspace/mekteb-arapsko-pismo run cap:open:ios
```
- U Xcode-u: **Product → Archive** za upload na App Store Connect.
- Verzija/Build se editira u `ios/App/App/Info.plist`.
- Apple Team i signing: `Signing & Capabilities` tab.

### Otvori u Android Studio
```bash
pnpm --filter @workspace/mekteb-arapsko-pismo run cap:open:android
```
- U Android Studio: **Build → Generate Signed Bundle / APK** za AAB upload na
  Google Play Console.
- Verzija: `android/app/build.gradle` → `versionCode` i `versionName`.
- Keystore: prvi put generišeš u Android Studio (Build → Generate Signed Bundle).
  **ČUVAJ keystore i lozinku** — bez njega nikad više ne možeš ažurirati app
  na Google Play-u.

## Regeneriši ikone i splash (kad mijenjaš logo)

Logo je u `artifacts/mekteb-arapsko-pismo/assets/logo.png` (1024×1024 PNG sa
prozirnom pozadinom preferirano). Splash i ikone se generišu automatski:

```bash
pnpm --filter @workspace/mekteb-arapsko-pismo run cap:assets
```

Generišu se sve potrebne veličine za iOS i Android (xxxhdpi, hdpi, itd.) +
splash screen za sve uređaje.

## Verzija app-a

Kad pravimo novu verziju za store:

**iOS** (`ios/App/App/Info.plist`):
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>  <!-- inkrementiraj svaki put -->
```

**Android** (`android/app/build.gradle`):
```gradle
defaultConfig {
    versionCode 1      // inkrementiraj svaki put
    versionName "1.0.0"
}
```

## Trenutni status (Phase 2 završen)

✅ Capacitor 8.x instaliran  
✅ `capacitor.config.ts` (bundle ID `net.mektebnet.app`, theme #248F8F)  
✅ Native iOS projekt (`ios/App/`) — Xcode-ready  
✅ Native Android projekt (`android/`) — Android Studio-ready  
✅ App + Network + StatusBar + SplashScreen plugin-i  
✅ Backend CORS dozvoljava `capacitor://localhost` + `https://localhost`  
✅ Mobile build skripta sa `VITE_API_BASE_URL=https://mekteb.net/api` i native OneSignal App ID prosljeđivanjem

✅ Push notifikacije (web) — radi na produkciji  
✅ Push notifikacije (native iOS/Android) — kod + plugin instalirani; treba još APNs/FCM ključeve uploadovati u OneSignal dashboard (vidi sekciju "Push notifikacije" niže)  
⏳ **Phase 4**: Submit na App Store + Google Play

## Troubleshooting

**Pri `cap sync`:** `Capacitor could not find the web assets directory "./dist/public"`  
→ Pokreni `pnpm run build:mobile` prije sync-a.

**iOS app ne može doći do API-ja:** Provjeri da je `Info.plist`
`NSAppTransportSecurity → NSAllowsArbitraryLoads` postavljen samo ako koristiš
HTTP. Mi koristimo isključivo HTTPS (`https://mekteb.net`) pa ne treba.

**Android: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`** pri reinstall-u na uređaj  
→ Uninstall stari APK prvo: `adb uninstall net.mektebnet.app`.

---

## Push notifikacije (OneSignal — Faza 3)

Web push (browser/PWA) radi automatski preko OneSignal Web SDK-a — vidi `src/lib/push.ts`. Native iOS/Android push isto je sad implementiran (`src/lib/native-push.ts`) i `push.ts` automatski rutira na native modul kad je `Capacitor.isNativePlatform() === true`. Plugin (`onesignal-cordova-plugin`) je već u `package.json`.

Za rad u produkciji ostaje samo dashboard setup (APNs ključ za iOS, FCM Service Account JSON za Android) i Xcode capabilities.

### 1. Instaliraj / sinhroniziraj plugin u native projekte

Plugin je već u `dependencies` (`onesignal-cordova-plugin`). Nakon `pnpm install`
na iMac-u, Android možeš sinhronizirati ovako:

```bash
pnpm --filter @workspace/mekteb-arapsko-pismo exec cap sync android
```

Android sync automatski dodaje OneSignal Gradle dependency i kopira plugin
metadata u `android/app/src/main/assets/capacitor.config.json`.

> **iOS — obavezna priprema prije sync-a:** postojeći iOS Capacitor projekat
> koristi Swift Package Manager, a `onesignal-cordova-plugin` za iOS podržava
> samo CocoaPods. Zato generički `cap sync` trenutno pokuša dodati nepostojeći
> Swift paket. Prije iOS builda projekat treba jednokratno migrirati na
> CocoaPods, zatim pokrenuti `pod install` i `cap sync ios`. Ne pokušavaj
> zaobići grešku ručnim dodavanjem paketa u Xcode — time se ne linka OneSignal
> SDK.

### 2. Native init — već implementirano

`src/lib/native-push.ts` (auto-init kroz `initOneSignal()` u `main.tsx`):
- `OneSignal.initialize(VITE_ONESIGNAL_APP_ID)` na boot
- `OneSignal.login(userId)` u `auth.tsx` nakon login-a (preko unified `loginPushUser`)
- `OneSignal.Notifications.requestPermission(true)` kad korisnik klikne "Uključi" u `PushPrompt` banneru
- `POST /api/push/register` sa `{ playerId, platform: "ios" | "android", userAgent }`
- Subscription change listener auto-registruje token kad se permission tek prvi put dā

Backend (`/push/register`) već prihvata `platform: "web" | "ios" | "android"`.

### 3. iOS (APNs) setup u OneSignal dashboard-u

> ✅ **Već automatski u repo-u** (sve sam ti pripremio):
> - `ios/App/App/Info.plist` — `UIBackgroundModes → remote-notification`
> - `ios/App/App/App.entitlements` — `aps-environment = development` (Xcode automatski mijenja u `production` pri Archive-u za App Store)
> - `ios/App/App.xcodeproj/project.pbxproj` — `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` u Debug i Release config-u
>
> Ovo znači da **NE moraš ručno klikati "+ Capability" u Xcode-u** — kad otvoriš `App.xcworkspace`, Xcode će već pokazati **Push Notifications** i **Background Modes → Remote notifications** kao aktivne. Ako ipak ne vidiš, klikni Signing & Capabilities tab → ako je crveni warning oko provisioning profila, klikni "Try Again" da Xcode regeneriše profil sa Push Notifications entitlement-om vezanim za tvoj Apple Team.

Tvoji koraci na Apple-u i u OneSignal-u:

1. **Apple Developer portal** (https://developer.apple.com/account/resources/authkeys):
   - Keys → `+` → naziv "Mekteb APNs" → check **Apple Push Notifications service (APNs)** → Continue → Register
   - Skini **.p8 file** (samo jednom — čuvaj ga!) i zapamti **Key ID** (npr. `ABC123DEFG`)
   - Zapamti **Team ID** (gore desno u portalu, npr. `XYZ987WVUT`)
2. **OneSignal dashboard** (https://app.onesignal.com → Mekteb app) → Settings → Platforms → **Apple iOS (APNs)**:
   - Choose Integration: **Token-based** (preporučeno; .p8 ne istječe za razliku od .p12)
   - Upload **.p8 file**
   - Unesi **Key ID**, **Team ID**, **Bundle ID** (`net.mektebnet.app`)
   - Save
3. U Xcode-u nakon `cap sync` — provjeri Signing & Capabilities da je **Push Notifications** capability prisutan (trebao bi biti automatski jer je entitlements file već linkovan). Ako fali, klikni `+ Capability → Push Notifications`.

### 4. Android (FCM) setup u OneSignal dashboard-u

> ✅ **Već automatski u repo-u**:
> - `android/app/src/main/AndroidManifest.xml` — `POST_NOTIFICATIONS` (Android 13+ runtime permission), `WAKE_LOCK`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`
> - `android/app/build.gradle` — `applicationId "net.mektebnet.app"` (mora se poklapati sa Firebase appom)
> - `android/build.gradle` — `com.google.gms:google-services:4.4.4` Gradle plugin (aktivira se SAMO ako `google-services.json` postoji — pogledaj `android/app/build.gradle` red 47-54)

Tvoji koraci u Firebase-u i OneSignal-u:

1. **Firebase Console** (https://console.firebase.google.com):
   - Create project "Mekteb" (ili koristi postojeći ako imaš)
   - **Add app → Android** → Package name: `net.mektebnet.app` → App nickname: "Mekteb" → Register
   - Skini **`google-services.json`** → spasi u `artifacts/mekteb-arapsko-pismo/android/app/google-services.json`
   - Project Settings (zupčanik gore) → **Service accounts** tab → **Generate new private key** → potvrdi → skini JSON (ovo je za OneSignal, NE isti fajl kao google-services.json)
2. **OneSignal dashboard** → Settings → Platforms → **Google Android (FCM)**:
   - Upload **Service Account JSON** (onaj iz Service accounts taba)
   - Save

### 5. Test

Nakon prvog build-a:
1. Otvori app na uređaju (simulator ne podržava push), prihvati permission prompt
2. OneSignal dashboard → **Audience → All Users** → trebalo bi vidjeti uređaj
3. Pošalji **Test Push** iz dashboarda → trebao bi stići

### Trenutni status

- ✅ Web push (mekteb.net) — radi
- ✅ Backend trigger-i (nova poruka, nova zadaća)
- ✅ Native Android — OneSignal plugin, build-time App ID i Gradle dependency su sinhronizirani
- 🟡 Native iOS — kod i APNs konfiguracija su spremni, ali prije prvog device builda treba CocoaPods migracija zbog kompatibilnosti OneSignal Cordova plugina sa SPM-om
- ✅ iOS native config — `Info.plist` (UIBackgroundModes), `App.entitlements` (aps-environment), `project.pbxproj` (CODE_SIGN_ENTITLEMENTS u Debug + Release)
- ✅ Android native config — `AndroidManifest.xml` (POST_NOTIFICATIONS + WAKE_LOCK + VIBRATE + RECEIVE_BOOT_COMPLETED)
- ⏸ **Preostalo TEBI** (na iMac-u i u browser-u, ne mogu ja iz Replita):
  1. Apple Developer portal → generiši APNs `.p8` ključ
  2. Firebase Console → kreiraj projekat za `net.mektebnet.app`, skini `google-services.json` u `android/app/`, generiši Service Account JSON
  3. OneSignal dashboard → upload APNs .p8 (iOS) + Service Account JSON (Android)
   4. iMac: `pnpm install` → `pnpm exec cap sync android` → `cap open android`; iOS otvori tek nakon CocoaPods migracije
  5. Xcode → odaberi Apple Team u Signing & Capabilities (Push Notifications capability je već u entitlements-u)
  6. Build na fizički iPhone i Android telefon → testiraj push iz OneSignal dashboard "New Message → All Users"
