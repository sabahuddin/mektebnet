---
name: OneSignal iOS i Swift Package Manager
description: OneSignal Cordova plugin koristi CocoaPods, dok postojeći Capacitor iOS projekt koristi SPM.
---

## Pravilo

Ne pokretati generički iOS `cap sync` s OneSignal Cordova pluginom dok se
Capacitor iOS projekat ne migrira na CocoaPods.

**Why:** Plugin deklarira samo CocoaPods dependency (`OneSignalXCFramework`) i
nema Swift `Package.swift`. Capacitorov SPM sync zato generira nevažeću
referencu na lokalni paket koji ne postoji; Xcode tada ne može pouzdano linkati
native OneSignal SDK.

**How to apply:** Android se može sinhronizirati odvojeno. Prije iOS device
builda uraditi jednokratnu, pažljivu CocoaPods migraciju koja čuva bundle ID,
entitlements i signing postavke, zatim `pod install` i `cap sync ios` na macOS-u.