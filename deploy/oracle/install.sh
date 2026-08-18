#!/usr/bin/env bash
set -euo pipefail

sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo useradd --system --create-home --shell /bin/bash ivy 2>/dev/null || true
sudo mkdir -p /srv/ivy-pearls
sudo chown -R ivy:ivy /srv/ivy-pearls

echo "Base server prepared."
echo "Copy the project to /srv/ivy-pearls, create /srv/ivy-pearls/.env, then run:"
echo "  cd /srv/ivy-pearls && npm ci && npm run build"
echo "  sudo cp deploy/oracle/ivy-pearls.service /etc/systemd/system/"
echo "  sudo cp deploy/oracle/nginx.conf /etc/nginx/sites-available/ivy-pearls"
echo "  sudo ln -sf /etc/nginx/sites-available/ivy-pearls /etc/nginx/sites-enabled/ivy-pearls"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "  sudo systemctl daemon-reload && sudo systemctl enable --now ivy-pearls"
echo "  sudo certbot --nginx -d ivyandpearls.co.uk -d www.ivyandpearls.co.uk"
