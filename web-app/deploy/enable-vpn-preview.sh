#!/usr/bin/env bash
set -euo pipefail

PREVIEW_DIR="/etc/ssl/localcerts/redesign-reg-vpn-preview"
PREVIEW_CERT="$PREVIEW_DIR/fullchain.pem"
PREVIEW_KEY="$PREVIEW_DIR/privkey.pem"
PREVIEW_HTTP_SITE="redesign-reg-vpn-preview.conf"
PREVIEW_HTTPS_SITE="redesign-reg-vpn-preview-ssl.conf"
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

install -m 0644 /var/www/reDesign-REG/web-app/deploy/apache/redesign-reg-vpn-preview.conf /etc/apache2/sites-available/"$PREVIEW_HTTP_SITE"
install -m 0644 /var/www/reDesign-REG/web-app/deploy/apache/redesign-reg-vpn-preview-ssl.conf /etc/apache2/sites-available/"$PREVIEW_HTTPS_SITE"
install -m 0644 /var/www/reDesign-REG/web-app/deploy/systemd/redesign-reg-web.service /etc/systemd/system/redesign-reg-web.service

a2ensite "$PREVIEW_HTTP_SITE" "$PREVIEW_HTTPS_SITE"
apache2ctl configtest
systemctl daemon-reload
systemctl enable redesign-reg-web.service
/usr/local/bin/node /var/www/reDesign-REG/web-app/deploy/release-web.mjs --activate
systemctl reload apache2

echo "VPN preview enabled at http://172.16.214.69/ and https://172.16.214.69/"
