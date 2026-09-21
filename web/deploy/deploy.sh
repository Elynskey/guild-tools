#!/usr/bin/env bash
# Runs ON THE SERVER (as root). Installs the Guild Tools phone page behind the existing tailnet-only nginx site.
#   1. backs up everything it touches to /root/backups/guild-web-<stamp>
#   2. writes the gateway key snippet (root-only) from the proxy's own .env, never printing it
#   3. installs the /guild/ locations and includes them from the default site (once)
#   4. `nginx -t`; if it fails, or anything else fails, puts every file back and reloads nginx
#   5. publishes the built page to /var/www/guild and reloads nginx (never restarts it)
# Expects the built page in /tmp/guild-web/dist and guild-tools-web.conf in /tmp/guild-web/.
set -euo pipefail

SITE=/etc/nginx/sites-enabled/default
SNIP=/etc/nginx/snippets
WWW=/var/www/guild
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/backups/guild-web-$STAMP
SRC=/tmp/guild-web
ENV_FILE=/root/guild-tools-proxy/.env

mkdir -p "$BK"
cp -p "$SITE" "$BK/default"
for f in guild-tools-web.conf guild-tools-gateway.conf; do [ -f "$SNIP/$f" ] && cp -p "$SNIP/$f" "$BK/$f" || true; done
HAD_WWW=no
if [ -d "$WWW" ]; then cp -a "$WWW" "$BK/www-guild"; HAD_WWW=yes; fi
echo "backups: $BK"

rollback() {
  echo "!! FAILED, putting everything back"
  cp -p "$BK/default" "$SITE"
  for f in guild-tools-web.conf guild-tools-gateway.conf; do
    if [ -f "$BK/$f" ]; then cp -p "$BK/$f" "$SNIP/$f"; else rm -f "$SNIP/$f"; fi
  done
  if [ "$HAD_WWW" = yes ]; then rm -rf "$WWW" && cp -a "$BK/www-guild" "$WWW"; else rm -rf "$WWW"; fi
  nginx -t && systemctl reload nginx || true
  echo "rolled back; nginx is serving the previous configuration"
}
trap rollback ERR

# --- the gateway key: read from the proxy's .env, written only to a root-only snippet, never echoed
KEY=$(awk -F= '/^PROXY_API_KEY=/{print substr($0, index($0, "=") + 1)}' "$ENV_FILE" | tr -d "\"'\r")
[ "${#KEY}" -ge 32 ] || { echo "no usable PROXY_API_KEY in $ENV_FILE"; false; }
umask 077
{
  printf 'proxy_set_header X-Proxy-Key "%s";\n' "$KEY"
  printf 'proxy_set_header X-Guild-Tools-Mode prod;\n'
  printf 'proxy_set_header Host $host;\n'
  printf 'proxy_set_header Connection "";\n'
  printf 'proxy_connect_timeout 5s;\n'
  printf 'proxy_read_timeout 120s;\n'
  printf 'add_header Cache-Control "no-store" always;\n'
} > "$SNIP/guild-tools-gateway.conf"
chmod 600 "$SNIP/guild-tools-gateway.conf"
unset KEY
umask 022

# --- the locations, and the one include line in the default site
install -m 644 "$SRC/guild-tools-web.conf" "$SNIP/guild-tools-web.conf"
if ! grep -q 'snippets/guild-tools-web.conf' "$SITE"; then
  python3 - "$SITE" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf8').read()
anchor = 'include snippets/maintenance.conf;'
assert s.count(anchor) == 1, 'expected exactly one maintenance include to anchor on'
s = s.replace(anchor, anchor + '\n\n\t# Guild Tools phone page (read-only, tailnet-only)\n\tinclude snippets/guild-tools-web.conf;', 1)
open(p, 'w', encoding='utf8').write(s)
PY
fi
nginx -t

# --- the page itself, swapped in whole
rm -rf "$WWW.new"
cp -r "$SRC/dist" "$WWW.new"
chmod -R a+rX "$WWW.new"
[ -d "$WWW" ] && mv "$WWW" "$WWW.old"
mv "$WWW.new" "$WWW"
rm -rf "$WWW.old"

systemctl reload nginx
trap - ERR
echo "nginx reloaded: $(systemctl is-active nginx)"
echo "published: $(ls "$WWW" | tr '\n' ' ')"
echo "backup (for rollback): $BK"
