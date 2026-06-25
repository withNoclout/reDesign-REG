#!/usr/bin/env bash
set -euo pipefail

STORAGE_ROOT="${LOCAL_STORAGE_ROOT:-/var/www/reDesign-REG/web-app/storage}"
PUBLIC_SUBDIRS=(
  "portfolio-assets/news"
  "portfolio-assets/portfolio"
  "profile-images"
  "tmp"
)

mkdir -p "$STORAGE_ROOT"
for dir in "${PUBLIC_SUBDIRS[@]}"; do
  mkdir -p "$STORAGE_ROOT/$dir"
done

chown -R www-data:www-data "$STORAGE_ROOT"
find "$STORAGE_ROOT" -type d -exec chmod 775 {} +
find "$STORAGE_ROOT" -type f -exec chmod 664 {} +

echo "Local storage initialized at $STORAGE_ROOT"
