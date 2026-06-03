#!/usr/bin/env bash
set -euo pipefail

HTTP_SITE="redesign-reg.kmutnb.ac.th.conf"
HTTPS_SITE="redesign-reg.kmutnb.ac.th-ssl.conf"
ENV_FILE="/etc/redesign-reg/redesign-reg-web.env"
CERT_FILE="/etc/letsencrypt/live/redesign-reg.kmutnb.ac.th/fullchain.pem"
KEY_FILE="/etc/letsencrypt/live/redesign-reg.kmutnb.ac.th/privkey.pem"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a
/usr/local/bin/node /var/www/reDesign-REG/web-app/deploy/check-env.mjs

if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "TLS certificate files for redesign-reg.kmutnb.ac.th are missing." >&2
  exit 1
fi

a2ensite "$HTTP_SITE" "$HTTPS_SITE"
apache2ctl configtest
systemctl daemon-reload
systemctl enable --now redesign-reg-web.service
systemctl reload apache2

echo "redesign-reg.kmutnb.ac.th activation completed."
