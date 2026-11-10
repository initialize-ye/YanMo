# Android PWA / TWA 打包说明

研墨现在是可安装的 PWA，Android 用户有两种方式使用：

1. 直接用 Chrome 打开部署地址，菜单里选择「添加到主屏幕」。
2. 用 PWA 打包工具生成 TWA（Trusted Web Activity）APK，安装后像普通应用一样从桌面启动。

TWA 的本质是一个不带浏览器地址栏的 WebView，页面仍然从你的 HTTPS 域名加载，因此：

- 不需要把 Node.js 或 Next.js 塞进 APK
- APK 体积很小
- 网页更新后，用户不用重新安装 APK
- 必须联网；AI 批改本来也需要网络

## 前提

- 应用已经部署到 HTTPS 域名，例如 `https://yanmo.example.com`
- 部署版本包含以下文件（本仓库已经提供）：
  - `/manifest.webmanifest`
  - `/icons/icon-192.png`、`/icons/icon-512.png`、`/icons/icon-maskable-512.png`
  - `/sw.js`

可以先访问 `https://你的域名/manifest.webmanifest` 检查清单是否能正常返回。

## 推荐：PWABuilder 生成 APK

PWABuilder 是微软提供的在线打包工具，不需要本地安装 Android SDK。

1. 打开 https://www.pwabuilder.com/
2. 输入你的 HTTPS 地址，等待检测报告。
3. 选择 **Android**，点击 **Generate Package**。
4. 填写：
   - App name：`研墨 AI`
   - Short name：`研墨`
   - Package ID：`com.yanmo.app`（建议值，之后不能随意修改）
   - Version：与网站版本一致，例如 `0.2.0`
   - Signing：使用默认新建签名，或选择自己的 keystore
5. 下载生成的 zip，里面通常包含：
   - `*.apk`
   - `assetlinks.json`
   - 签名密钥（请妥善保存，后续升级 APK 必须使用同一个密钥）
6. 把 `assetlinks.json` 放到本项目的：

   ```text
   public/.well-known/assetlinks.json
   ```

   然后重新部署网站。这个文件用于让 Android 验证 APK 和域名属于同一方，验证成功后 TWA 才不会显示地址栏。

7. 安装 APK，首次启动如果顶部没有地址栏，说明验证成功。

如果仍然显示地址栏：

- 确认 `https://你的域名/.well-known/assetlinks.json` 可以访问，且 `Content-Type` 是 JSON
- 检查 `package_name` 和 `sha256_cert_fingerprints` 与 APK 完全一致
- 清除 Chrome 的站点数据后重试

`assetlinks.json` 的内容格式如下（指纹由打包工具生成，不要手写猜测）：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yanmo.app",
      "sha256_cert_fingerprints": ["REPLACE_WITH_YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

## 进阶：Bubblewrap CLI

如果本机有 JDK 17 和 Android SDK，也可以用 Google 官方的 Bubblewrap：

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://你的域名/manifest.webmanifest
bubblewrap build
```

`bubblewrap init` 会询问包名、应用名称、签名密钥等信息，并生成 `assetlinks.json` 片段。首次运行会引导安装 Android SDK 组件。

## 数据与安全

- TWA 中的数据仍保存在 Android WebView 的站点存储中，清理应用数据会丢失本地报告，建议在写作档案页导出备份。
- APK 本身不包含 API Key。用户在应用内「设置」填写 Key，或由服务端 `.env.local` 配置。
- 不要让公开 APK 携带你的服务端 API Key。公开分发时建议使用访客自带 Key，或增加鉴权与限流。
