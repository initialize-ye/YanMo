#!/usr/bin/env bash
# 研墨 AI —— 拉取最新 GitHub Release 的 exe 与更新清单到本机 Nginx 静态目录
# 由 cron 每 10 分钟执行一次（以 yanmo 用户运行）。
#
# 仓库为公开时无需任何令牌；若用 gh 且已登录也会自动优先使用。
# 依赖：curl、jq（gh 可选）
# 环境：YANMO_PUBLIC_URL=https://你的域名   （也可写在 /srv/yanmo/app/.env.production）

set -euo pipefail

# 防止多个 cron 并发下载互相覆盖
LOCK_FILE="${TMPDIR:-/tmp}/yanmo-pull-release.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[pull-release] 上一次同步仍在进行，跳过本次"
  exit 0
fi

REPO="${YANMO_REPO:-initialize-ye/YanMo}"
PUBLIC_DIR="${YANMO_PUBLIC_DIR:-/srv/yanmo/public}"
DL_DIR="${PUBLIC_DIR}/downloads"
UP_DIR="${PUBLIC_DIR}/updates"
PUBLIC_URL="${YANMO_PUBLIC_URL:-}"

mkdir -p "$DL_DIR" "$UP_DIR"

if [ -z "$PUBLIC_URL" ] && [ -f /srv/yanmo/app/.env.production ]; then
  PUBLIC_URL="$(grep -E '^YANMO_PUBLIC_URL=' /srv/yanmo/app/.env.production | head -n1 | cut -d= -f2- || true)"
fi
PUBLIC_URL="${PUBLIC_URL%/}"

UA="YanMo-Release-Mirror"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  META="$(gh api "repos/$REPO/releases/latest")"
else
  META="$(curl -fsSL -H "User-Agent: $UA" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/releases/latest")"
fi

TAG="$(echo "$META" | jq -r '.tag_name // empty')"
if [ -z "$TAG" ]; then
  echo "[pull-release] 没有找到 release，跳过"
  exit 0
fi
VERSION="${TAG#v}"

EXE_NAME="$(echo "$META" | jq -r '[.assets[].name] | map(select(test("^YanMo-.*-win64\\.exe$"))) | first // empty')"
EXE_URL="$(echo "$META" | jq -r --arg n "$EXE_NAME" '[.assets[] | select(.name==$n) | .browser_download_url] | first // empty')"

if [ -z "$EXE_NAME" ] || [ -z "$EXE_URL" ]; then
  echo "[pull-release] $TAG 没有 exe 资产，跳过"
  exit 0
fi

# 只在需要时下载（同名且大小一致则跳过）
EXPECT_SIZE="$(echo "$META" | jq -r --arg n "$EXE_NAME" '[.assets[] | select(.name==$n) | .size] | first // 0')"
LOCAL_FILE="$DL_DIR/$EXE_NAME"
COMPLETE=0
if [ -f "$LOCAL_FILE" ] && [ "$(stat -c%s "$LOCAL_FILE")" = "$EXPECT_SIZE" ]; then
  COMPLETE=1
fi

# 先写更新清单：exe 已镜像则指向本站，否则暂指向 GitHub（仓库公开后可下载）
if [ "$COMPLETE" = "1" ]; then
  URL="${PUBLIC_URL}/downloads/${EXE_NAME}"
else
  URL="$EXE_URL"
fi
jq -n --arg v "$VERSION" --arg u "$URL" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{version:$v, url:$u, notes:("见 GitHub Release v"+$v), publishedAt:$t}' > "$UP_DIR/latest.json.tmp"
mv "$UP_DIR/latest.json.tmp" "$UP_DIR/latest.json"
echo "[pull-release] 更新清单：$UP_DIR/latest.json（$VERSION → $URL）"

if [ "$COMPLETE" = "1" ]; then
  echo "[pull-release] exe 已是最新：$EXE_NAME"
else
  echo "[pull-release] 下载 $EXE_NAME ...（支持断点续传，网络慢时后续 cron 会继续）"
  # -C - 断点续传；低于 8KB/s 持续 60s 视为卡死，重试
  curl -fL -C - --retry 5 --retry-delay 5 --retry-all-errors \
       --connect-timeout 20 --speed-limit 8192 --speed-time 60 \
       -H "User-Agent: $UA" -o "$LOCAL_FILE.part" "$EXE_URL"
  mv "$LOCAL_FILE.part" "$LOCAL_FILE"
  echo "[pull-release] exe 已更新：$LOCAL_FILE"
  # 下载完成后把清单切换为本站地址
  URL="${PUBLIC_URL}/downloads/${EXE_NAME}"
  jq -n --arg v "$VERSION" --arg u "$URL" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{version:$v, url:$u, notes:("见 GitHub Release v"+$v), publishedAt:$t}' > "$UP_DIR/latest.json.tmp"
  mv "$UP_DIR/latest.json.tmp" "$UP_DIR/latest.json"
  echo "[pull-release] 清单已切换到本站：$URL"
fi

# 清理旧 exe，只保留最近 3 个版本
ls -1t "$DL_DIR"/YanMo-*-win64.exe 2>/dev/null | tail -n +4 | xargs -r rm -f
