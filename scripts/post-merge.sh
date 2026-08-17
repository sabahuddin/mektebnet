#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Drizzle can still ask whether a populated table should be truncated even with
# --force. Always choose the safe option: keep existing rows and add the
# constraint without truncating data.
printf 'n\n' | pnpm --filter db push-force
