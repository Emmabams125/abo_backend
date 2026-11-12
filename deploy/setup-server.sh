#!/usr/bin/env bash
# One-time setup for a fresh Debian 12/13 VPS. Run as root:
#   bash setup-server.sh
# Installs Node 22, PM2, Redis, Nginx, Certbot, a firewall and swap, and
# creates the unprivileged "abo" user the app runs as.
set -euo pipefail

echo "==> Updating system"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y curl git ca-certificates build-essential ufw nginx redis-server certbot python3-certbot-nginx

echo "==> Installing Node.js 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "==> Configuring Redis (local only, BullMQ-safe eviction policy)"
sed -i 's/^#\?\s*bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
sed -i 's/^#\?\s*maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
systemctl enable --now redis-server
systemctl restart redis-server

echo "==> Adding 2GB swap (2GB RAM is tight while building)"
if [ -z "$(swapon --show --noheadings)" ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall: allow SSH, HTTP, HTTPS only"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Creating app user 'abo'"
id abo >/dev/null 2>&1 || adduser --disabled-password --gecos "" abo

echo "==> Done. Node $(node -v), Redis $(redis-cli ping)"
