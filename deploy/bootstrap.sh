#!/usr/bin/env bash
# 研墨 AI —— Ubuntu 24.04 服务器一键初始化（全新机器执行）
# 用法：sudo bash deploy/bootstrap.sh
# 作用：时区、swap、基础包、防火墙、Node 22、运行用户与目录。
# 不包含：拉代码、填 AI Key、域名证书（见 deploy/README.md 后续步骤）。

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 sudo 运行：sudo bash deploy/bootstrap.sh" >&2
  exit 1
fi

echo "==> 1/6 设置时区"
timedatectl set-timezone Asia/Shanghai || true

echo "==> 2/6 配置 2G swap（若已存在则跳过）"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "swap 已存在，跳过"
fi

echo "==> 3/6 安装基础软件"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install curl git ufw fail2ban unattended-upgrades nginx jq ca-certificates

echo "==> 4/6 防火墙（仅放行 22/80/443）"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

echo "==> 5/6 安装 Node.js 22 LTS"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get -y install nodejs
fi
node -v
npm -v

echo "==> 6/6 创建运行用户与目录"
id -u yanmo >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin yanmo
mkdir -p /srv/yanmo/app /srv/yanmo/data /srv/yanmo/public/downloads /srv/yanmo/public/updates /var/www/certbot
chown -R yanmo:yanmo /srv/yanmo

echo
echo "✅ 初始化完成。下一步："
echo "   1) 以 yanmo 用户把代码 clone 到 /srv/yanmo/app（详见 deploy/README.md 第二节）"
echo "   2) cp deploy/env.example .env.production 并填入 AI_API_KEY"
echo "   3) 复制 deploy/systemd/yanmo.service 到 /etc/systemd/system/ 并 enable"
echo "   4) 配置 Nginx 与 HTTPS（deploy/README.md 第三节）"
