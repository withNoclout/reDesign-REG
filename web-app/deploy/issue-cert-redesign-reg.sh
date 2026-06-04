#!/usr/bin/env bash
set -euo pipefail

DOMAIN="redesign-reg.kmutnb.ac.th"
WEBROOT="/var/www/reDesign-REG/web-app/public"
HTTP_SITE="redesign-reg.kmutnb.ac.th.conf"
HTTPS_SITE="redesign-reg.kmutnb.ac.th-ssl.conf"
PREVIEW_SITE="redesign-reg-vpn-preview-ssl.conf"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$EMAIL" ]]; then
  echo "CERTBOT_EMAIL is required." >&2
  exit 1
fi

if ! getent ahosts "$DOMAIN" >/dev/null; then
  echo "DNS for $DOMAIN is not resolvable from this host yet." >&2
  exit 1
fi

a2ensite "$HTTP_SITE"
apache2ctl configtest
systemctl reload apache2

certbot certonly \
  --webroot \
  -w "$WEBROOT" \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL"

a2ensite "$HTTPS_SITE"
if [[ -e /etc/apache2/sites-enabled/"$PREVIEW_SITE" ]]; then
  a2dissite "$PREVIEW_SITE"
fi
apache2ctl configtest
systemctl reload apache2

echo "TLS certificate issued and SSL vhost enabled for $DOMAIN."
