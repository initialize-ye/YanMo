#!/usr/bin/env bash
# 研墨 AI —— 拉取最新 GitHub Release 的 exe 与更新清单到本机 Nginx 静态目录
# 由 cron 每 10 分钟执行一次（以 yanmo 用户运行）。
#
# 依赖：gh（已登录，且对仓库有读权限）；jq
# 环境：YANMO_PUBLIC_URL=https://你的域名   （写入 /srv/yanmo/app/.env.production 亦可）

set -euo pipefail

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

TAG="$(gh release view --repo "$REPO" --json tagName --jq .tagName)"
if [ -z "$TAG" ]; then
  echo "[pull-release] 没有找到 release，跳过"
  exit 0
fi
VERSION="${TAG#v}"

# 列出该 release 的资产名
ASSETS="$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')"

EXE_NAME="$(echo "$ASSETS" | grep -E '^YanMo-.*-win64\.exe$' | head -n1 || true)"
if [ -z "$EXE_NAME" ]; then
  echo "[pull-release] $TAG 没有 exe 资产，跳过"
  exit 0
fi

# 下载 exe（--clobber 覆盖同名）
gh release download "$TAG" --repo "$REPO" --pattern "$EXE_NAME" --dir "$DL_DIR" --clobber
echo "[pull-release] exe 已更新：$DL_DIR/$EXE_NAME"

# 更新清单：优先用 release 里的 latest.json，否则本地生成（并把 url 改成本站地址）
TMP_JSON="$(mktemp)"
if echo "$ASSETS" | grep -qx 'latest.json'; then
  gh release download "$TAG" --repo "$REPO" --pattern 'latest.json' --dir "$(dirname "$TMP_JSON")" --clobber >/dev/null 2>&1 || true
  # gh 会按资产名落盘，这里找到并读取
  FOUND="$(dirname "$TMP_JSON")/latest.json"
  if [ -f "$FOUND" ]; then cp "$FOUND" "$TMP_JSON"; fi
fi

if [ -s "$TMP_JSON" ]; then
  # 用 jq 强制覆盖 version/url，保证指向本站下载地址
  jq --arg v "$VERSION" \
     --arg u "${PUBLIC_URL}/downloads/${EXE_NAME}" \
     --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.version=$v | .url=$u | .publishedAt=(.publishedAt // $t)' "$TMP_JSON" > "$UP_DIR/latest.json"
else
  cat > "$UP_DIR/latest.json" <<JSON
{
  "version": "$VERSION",
  "url": "${PUBLIC_URL}/downloads/${EXE_NAME}",
  "notes": "见 GitHub Release $TAG",
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
fi
rm -f "$TMP_JSON"
echo "[pull-release] 更新清单已写入：$UP_DIR/latest.json（$VERSION）"

# 清理旧 exe，只保留最近 3 个版本
ls -1t "$DL_DIR"/YanMo-*-win64.exe 2>/dev/null | tail -n +4 | xargs -r rm -f
