#!/usr/bin/env bash
# 研墨 AI —— 服务器端部署脚本（可被 GitHub Actions 或手动调用）
# 作用：拉取最新代码 → 按需安装依赖 → 构建 → 重启服务 → 健康检查 →（失败则回滚）
#
# 用法：bash /srv/yanmo/app/deploy/deploy.sh
# 可调环境变量：APP_DIR(默认 /srv/yanmo/app) BRANCH(默认 main) RUN_USER(默认 yanmo)

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/yanmo/app}"
BRANCH="${BRANCH:-main}"
RUN_USER="${RUN_USER:-yanmo}"

as_user() { sudo -u "$RUN_USER" -H bash -lc "cd '$APP_DIR' && $*"; }

# 允许对属主不同的仓库执行 git（避免 dubious ownership 报错）
sudo -u "$RUN_USER" -H git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

echo "==> [1/7] 记录当前版本"
PREV="$(as_user "git rev-parse HEAD" 2>/dev/null || echo "")"
echo "prev=$PREV"

echo "==> [2/7] 拉取 origin/$BRANCH"
as_user "git fetch --prune origin"
as_user "git reset --hard origin/$BRANCH"
NEW="$(as_user "git rev-parse HEAD")"
echo "new=$NEW"

if [ "$PREV" = "$NEW" ] && sudo systemctl is-active --quiet yanmo; then
  echo "==> 代码无变化且服务正常，跳过重建"
  exit 0
fi

echo "==> [3/7] 依赖（package-lock 变化时才 npm ci）"
LOCK_HASH_FILE="$APP_DIR/.next/.deploy-lock-hash"
CUR_HASH="$(sha256sum "$APP_DIR/package-lock.json" | awk '{print $1}')"
PREV_HASH="$(cat "$LOCK_HASH_FILE" 2>/dev/null || echo "")"
if [ "$CUR_HASH" != "$PREV_HASH" ]; then
  echo "    lock 有变化，执行 npm ci"
  as_user "npm ci --no-audit --no-fund"
  mkdir -p "$APP_DIR/.next"
  echo "$CUR_HASH" | sudo tee "$LOCK_HASH_FILE" >/dev/null
  sudo chown "$RUN_USER:$RUN_USER" "$LOCK_HASH_FILE"
else
  echo "    lock 未变，跳过 npm ci"
fi

echo "==> [4/7] 构建 Next（standalone）"
as_user "NODE_OPTIONS=--max-old-space-size=2560 npm run build && npm run prepare:standalone"

echo "==> [5/7] 重启服务"
sudo systemctl restart yanmo

echo "==> [6/7] 健康检查"
ok=0
for i in $(seq 1 30); do
  if curl -sf -m 3 http://127.0.0.1:3000/api/status >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done

if [ "$ok" = "1" ]; then
  echo "==> [7/7] 部署成功：$NEW"
  sudo systemctl is-active yanmo
  exit 0
fi

echo "!!! 健康检查失败，开始回滚到 $PREV"
if [ -n "$PREV" ]; then
  as_user "git reset --hard $PREV"
  as_user "NODE_OPTIONS=--max-old-space-size=2560 npm run build && npm run prepare:standalone" || true
  sudo systemctl restart yanmo || true
  for i in $(seq 1 20); do
    curl -sf -m 3 http://127.0.0.1:3000/api/status >/dev/null 2>&1 && { echo "已回滚到 $PREV"; exit 1; }
    sleep 2
  done
fi
echo "回滚后仍不健康，请查看 journalctl -u yanmo"
exit 1
