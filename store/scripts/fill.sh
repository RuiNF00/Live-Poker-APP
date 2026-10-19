#!/usr/bin/env bash
# Replaces {{KEY}} tokens in every store template with values from store/config.env
# and writes the results to store/out/, keeping the same relative paths.
set -euo pipefail
# Bash 5.2+ treats & in a ${var//pat/rep} replacement as the match; values like "Replayer & Bankroll" need it literal.
shopt -u patsub_replacement 2>/dev/null || true

STORE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$STORE_DIR/config.env"

OUT="$STORE_DIR/out"
rm -rf "$OUT"
mkdir -p "$OUT"

KEYS=(SELLER_DETAILS APP_NAME STORE_NAME_PT STORE_NAME_EN APP_SUBTITLE_PT APP_SUBTITLE_EN DEVELOPER_NAME SUPPORT_EMAIL WEB_DOMAIN
      IOS_BUNDLE_ID ANDROID_PACKAGE EFFECTIVE_DATE COUNTRY)

cd "$STORE_DIR"
find listing web eas -type f | while read -r f; do
  mkdir -p "$OUT/$(dirname "$f")"
  content="$(cat "$f")"
  for k in "${KEYS[@]}"; do
    content="${content//\{\{$k\}\}/${!k}}"
  done
  printf '%s\n' "$content" > "$OUT/$f"
done

if grep -rn '{{[A-Z_]*}}' "$OUT" >/dev/null; then
  echo "Unfilled tokens remain:" >&2
  grep -rno '{{[A-Z_]*}}' "$OUT" | sort -u >&2
  exit 1
fi
echo "Filled templates written to $OUT"
