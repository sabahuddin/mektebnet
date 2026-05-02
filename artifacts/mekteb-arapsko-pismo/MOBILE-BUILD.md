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
i `.../android`) — ne treba `cap add` ponovo.

## Build cycle (svaki put kad praviš novu mobilnu verziju)

Iz root-a monorepoa:

```bash
# 1. Build web bundle sa produkcijskim API URL-om
pnpm --filter @workspace/mekteb-arapsko-pismo run build:mobile

# 2. Sync — kopira dist/public u native projekte + ažurira plugin-e
pnpm --filter @workspace/mekteb-arapsko-pismo exec cap sync

# Ili oboje u jednom koraku:
pnpm --filter @workspace/mekteb-arapsko-pismo run cap:sync
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
✅ Mobile build skripta sa `VITE_API_BASE_URL=https://mekteb.net/api`  

⏳ **Phase 3 (next)**: Push notifikacije preko OneSignal-a  
⏳ **Phase 4**: Submit na App Store + Google Play

## Troubleshooting

**Pri `cap sync`:** `Capacitor could not find the web assets directory "./dist/public"`  
→ Pokreni `pnpm run build:mobile` prije sync-a.

**iOS app ne može doći do API-ja:** Provjeri da je `Info.plist`
`NSAppTransportSecurity → NSAllowsArbitraryLoads` postavljen samo ako koristiš
HTTP. Mi koristimo isključivo HTTPS (`https://mekteb.net`) pa ne treba.

**Android: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`** pri reinstall-u na uređaj  
→ Uninstall stari APK prvo: `adb uninstall net.mektebnet.app`.
