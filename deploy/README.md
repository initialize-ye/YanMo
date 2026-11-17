# 研墨 AI —— 服务器部署手册（Ubuntu 24.04 LTS，4C4G）

> 目标：一台腾讯云服务器同时提供 ①电脑版网页公网访问 ②服务端 AI Key 代理
> 目标：一台腾讯云服务器托管 Web 端（账号登录、报告按用户存服务器、服务端可选 AI Key）。

---

## 一、服务器初始化（一次性）

```bash
# 1) 腾讯云控制台：重装为 Ubuntu 24.04 LTS，选「SSH 密钥」登录；安全组只放行 22/80/443
# 2) 以 root 或初始用户登录后：

# 时区
sudo timedatectl set-timezone Asia/Shanghai

# 2G swap（构建 Next 需要）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 基础包 + 加固
sudo apt update && sudo apt -y upgrade
sudo apt -y install curl git ufw fail2ban unattended-upgrades nginx
sudo ufw allow 22,80,443/tcp && sudo ufw --force enable

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
node -v   # 应为 v22.x

# 运行用户与目录
sudo useradd --system --create-home --shell /usr/sbin/nologin yanmo || true
sudo mkdir -p /srv/yanmo/app /srv/yanmo/data /var/www/certbot
sudo chown -R yanmo:yanmo /srv/yanmo
```

> 若禁用密码登录：编辑 `/etc/ssh/sshd_config` 设 `PasswordAuthentication no` 后 `sudo systemctl restart ssh`。

---

## 二、部署 Web（Next standalone）

```bash
sudo -u yanmo -H bash
cd /srv/yanmo/app

# 拉代码（仓库私有，请先在服务器生成部署密钥并加到仓库 Deploy keys，或用 https + PAT）
git clone git@github.com:initialize-ye/YanMo.git .

npm ci
NODE_OPTIONS=--max-old-space-size=3072 npm run build
npm run prepare:standalone     # 复制 .next/static 与 public 到 standalone

# 配置环境变量（AI Key 等）
cp deploy/env.example .env.production
chmod 600 .env.production && exit   # 退出 yanmo shell 后用编辑器填入真实 Key
```

```bash
# 安装 systemd 服务
sudo cp /srv/yanmo/app/deploy/systemd/yanmo.service /etc/systemd/system/yanmo.service
sudo systemctl daemon-reload
sudo systemctl enable --now yanmo
sudo systemctl status yanmo --no-pager
curl -s http://127.0.0.1:3000/api/status   # 应返回 JSON
```

---

## 三、Nginx + HTTPS

```bash
sudo cp /srv/yanmo/app/deploy/nginx/yanmo.conf /etc/nginx/sites-available/yanmo.conf
sudo ln -sf /etc/nginx/sites-available/yanmo.conf /etc/nginx/sites-enabled/yanmo.conf
sudo rm -f /etc/nginx/sites-enabled/default

# 把配置里的 your-domain.example.com 全部替换成你的域名
sudo sed -i 's/your-domain\.example\.com/你的域名/g' /etc/nginx/sites-available/yanmo.conf

# 先拿证书（会临时让 80 端口可验证）
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名

sudo nginx -t && sudo systemctl reload nginx
```

**没有域名 / 未备案**：把 443 段删掉，只保留一个 `listen 8080;` 的 server 块，
用 `http://服务器IP:8080` 验收（浏览器可访问即可，后续换域名再加 HTTPS）。
国内地域对公众提供 80/443 网站需要 **ICP 备案**；未备案时只能用非 80/443 端口或境外节点。

---

## 四、保护 AI Key（重要）

服务端配置了 `AI_API_KEY` 后，任何能打开网站的人都会消耗你的额度。二选一：

**方案 A：Nginx Basic Auth（仅自己用，最简单）**
```bash
sudo apt -y install apache2-utils
echo "youruser:$(openssl passwd -apr1 '你的密码')" | sudo tee /etc/nginx/.htpasswd
# 在 nginx 的 `location /api/ { ... }` 内加入：
#   auth_basic "YanMo";
#   auth_basic_user_file /etc/nginx/.htpasswd;
sudo nginx -t && sudo systemctl reload nginx
```
浏览器首次调用批改会弹一次登录框（也可直接改用应用自带的账号体系，Basic Auth 仅作额外一层）。

**方案 B：保留公开 + 严格限流**（已在 `yanmo.conf` 里配好 `limit_req`），适合给多人试用但接受一定额度风险。

---

## 五、账号与数据存储

- 用户注册后，密码以 **scrypt 加盐哈希** 存储在 `/srv/yanmo/data/users.json`；会话写入 `data/sessions.json`。
- 批改报告按用户存于 `data/reports/<userId>.json`，个人设置存于 `data/profiles/<userId>.json`。
- 目录由 systemd 的 `YANMO_DATA_DIR=/srv/yanmo/data` 指定（见 `deploy/env.example`），并纳入每日备份。
- 备份脚本 `yanmo-backup` 每日打包整个 `data` 目录，保留 7 份（见第七节）。

## 六、运维速查

```bash
sudo systemctl restart yanmo          # 重启应用
journalctl -u yanmo -f                # 应用日志
sudo tail -f /var/log/nginx/error.log # Nginx 日志
sudo certbot renew --dry-run          # 证书续期演练

# 升级
cd /srv/yanmo/app && sudo -u yanmo git pull
sudo -u yanmo npm ci && sudo -u yanmo bash -c 'NODE_OPTIONS=--max-old-space-size=3072 npm run build && npm run prepare:standalone'
sudo systemctl restart yanmo

# 备份数据目录
sudo tar czf /srv/yanmo/backup-$(date +%F).tgz -C /srv yanmo/data
```

---

## 七、验收清单

- [ ] `node -v` 为 v22；`sudo ufw status` 仅 22/80/443；`swapon --show` 有 2G
- [ ] `curl https://你的域名/` 返回首页 HTML
- [ ] `curl https://你的域名/api/status` 返回 `{"serverConfigured":true,...}`
- [ ] 不带 Key 在网页批改一篇成功（走服务端 Key）
- [ ] 压测 `/api/grade` 超过限额返回 429
