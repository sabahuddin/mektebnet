#!/usr/bin/env bash
# Build mobile bundle za Capacitor (iOS + Android).
#
# Pokreće se: pnpm --filter @workspace/mekteb-arapsko-pismo run build:mobile
#
# Razlika od običnog `pnpm build`:
#   - VITE_API_BASE_URL=https://mekteb.net/api  (mobile app ne smije relativni /api)
#   - VITE_ONESIGNAL_APP_ID se ugrađuje u native bundle za iOS/Android push
#   - BASE_PATH=/                                (mobile app live na svom origin-u)
#
# Nakon ove skripte, pokreni `npx cap sync android` da se dist/public kopira u
# android/app/src/main/assets/public. iOS sync čeka CocoaPods migraciju
# (detalji su u MOBILE-BUILD.md).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Copying h5p-standalone runtime to public/..."
node scripts/copy-h5p-standalone.mjs

echo "==> Building web bundle for mobile (production API)..."
# PORT je potreban samo za config eval (artifact koristi $PORT u dev serveru);
# pri buildu vrijednost se ignorira, ali config crashuje bez nje.
PORT="${PORT:-8000}" \
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://mekteb.net/api}" \
  VITE_ONESIGNAL_APP_ID="${VITE_ONESIGNAL_APP_ID:-${ONESIGNAL_APP_ID:-}}" \
  BASE_PATH="/" \
  pnpm exec vite build --config vite.config.ts

echo ""
echo "==> Build complete. Bundle u dist/public/"
echo ""
echo "Sljedeći korak (na iMac-u):"
echo "  pnpm run cap:sync             # siguran Android sync"
echo "  pnpm exec cap open android    # otvara Android Studio"
echo ""
echo "iOS: prije 'cap sync ios' uradi CocoaPods migraciju opisanu u MOBILE-BUILD.md."
