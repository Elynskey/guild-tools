#!/usr/bin/env bash
# Runs ON THE SERVER (as root). Publishes the Guild Tools TEST downloads behind the existing tailnet-only nginx site.
#   1. backs up the site file, the snippet and the current downloads to /root/backups/guild-test-<stamp>
#   2. installs the /guild/test/ locations and includes them from the default site (once)
#   3. `nginx -t`; if it fails, or anything else fails, puts every file back and reloads nginx
#   4. swaps the new files into /var/www/guild-test and reloads nginx (never restarts it)
# Expects the files to publish in /tmp/guild-test/site and guild-tools-test-downloads.conf in /tmp/guild-test/.
set -euo pipefail

SITE=/etc/nginx/sites-enabled/default
SNIP=/etc/nginx/snippets
CONF=guild-tools-test-downloads.conf
WWW=/var/www/guild-test
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/backups/guild-test-$STAMP
SRC=/tmp/guild-test

mkdir -p "$BK"
cp -p "$SITE" "$BK/default"
[ -f "$SNIP/$CONF" ] && cp -p "$SNIP/$CONF" "$BK/$CONF" || true
HAD_WWW=no
if [ -d "$WWW" ]; then cp -a "$WWW" "$BK/www-guild-test"; HAD_WWW=yes; fi
echo "backups: $BK"

rollback() {
  echo "!! FAILED, putting everything back"
  cp -p "$BK/default" "$SITE"
  if [ -f "$BK/$CONF" ]; then cp -p "$BK/$CONF" "$SNIP/$CONF"; else rm -f "$SNIP/$CONF"; fi
  if [ "$HAD_WWW" = yes ]; then rm -rf "$WWW" && cp -a "$BK/www-guild-test" "$WWW"; else rm -rf "$WWW"; fi
  nginx -t && systemctl reload nginx || true
  echo "rolled back; nginx is serving the previous configuration"
}
trap rollback ERR

install -m 644 "$SRC/$CONF" "$SNIP/$CONF"
if ! grep -q "snippets/$CONF" "$SITE"; then
  python3 - "$SITE" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf8').read()
anchor = 'include snippets/guild-tools-web.conf;'
assert s.count(anchor) == 1, 'expected exactly one phone-page include to anchor on'
s = s.replace(anchor, anchor + '\n\n\t# Guild Tools TEST downloads (static files, tailnet-only)\n\tinclude snippets/guild-tools-test-downloads.conf;', 1)
open(p, 'w', encoding='utf8').write(s)
PY
fi
nginx -t

rm -rf "$WWW.new"
cp -r "$SRC/site" "$WWW.new"
chmod -R a+rX "$WWW.new"
[ -d "$WWW" ] && mv "$WWW" "$WWW.old"
mv "$WWW.new" "$WWW"
rm -rf "$WWW.old"

systemctl reload nginx
trap - ERR
echo "nginx reloaded: $(systemctl is-active nginx)"
echo "published: $(ls "$WWW" | tr '\n' ' ')"
echo "backup (for rollback): $BK"
