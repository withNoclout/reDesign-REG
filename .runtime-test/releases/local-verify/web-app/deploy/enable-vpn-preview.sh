#!/usr/bin/env bash
set -euo pipefail

PREVIEW_DIR="/etc/ssl/localcerts/redesign-reg-vpn-preview"
PREVIEW_CERT="$PREVIEW_DIR/fullchain.pem"
PREVIEW_KEY="$PREVIEW_DIR/privkey.pem"
PREVIEW_SITE="redesign-reg-vpn-preview-ssl.conf"

mkdir -p "$PREVIEW_DIR"

if [[ ! -f "$PREVIEW_CERT" || ! -f "$PREVIEW_KEY" ]]; then
  openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 30 \
    -keyout "$PREVIEW_KEY" \
    -out "$PREVIEW_CERT" \
    -subj "/CN=172.16.214.69" \
    -addext "subjectAltName = IP:172.16.214.69"
  chmod 600 "$PREVIEW_KEY"
  chmod 644 "$PREVIEW_CERT"
fi

cp /var/www/reDesign-REG/web-app/deploy/apache/redesign-reg-vpn-preview-ssl.conf /etc/apache2/sites-available/$PREVIEW_SITE

a2ensite "$PREVIEW_SITE"
apache2ctl configtest
systemctl daemon-reload
systemctl enable redesign-reg-web.service
/usr/local/bin/node /var/www/reDesign-REG/web-app/deploy/release-web.mjs --activate
systemctl reload apache2

echo "VPN preview enabled at https://172.16.214.69/"
