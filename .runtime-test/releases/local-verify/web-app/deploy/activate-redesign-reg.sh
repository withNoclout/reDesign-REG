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

if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "TLS certificate files for redesign-reg.kmutnb.ac.th are missing." >&2
  exit 1
fi

a2ensite "$HTTP_SITE" "$HTTPS_SITE"
apache2ctl configtest
systemctl daemon-reload
systemctl enable redesign-reg-web.service
/usr/local/bin/node /var/www/reDesign-REG/web-app/deploy/release-web.mjs --activate
if [[ -f /etc/systemd/system/redesign-reg-agent-memory-refresh.timer ]]; then
  systemctl enable --now redesign-reg-agent-memory-refresh.timer
fi
if [[ -f /etc/systemd/system/redesign-reg-agent-memory-embeddings.timer ]]; then
  systemctl enable --now redesign-reg-agent-memory-embeddings.timer
fi
if [[ -f /etc/systemd/system/redesign-reg-agent-memory-refresh.service ]]; then
  systemctl start redesign-reg-agent-memory-refresh.service
fi

systemctl reload apache2

echo "redesign-reg.kmutnb.ac.th activation completed."
