# 研墨 AI 代码审计：多余部分与未完成部分

> 审计范围：仓库内全部源码（`app/`、`lib/`、`components/`、`middleware.ts`、`scripts/`、`deploy/`、构建与文档配置）。
> 审计方式：静态阅读（逐文件通读 + 交叉引用检索）。
> 审计边界：初版审计**未修改任何源码**；后续已按文档建议实施四个批次，实施状态见第六节。文中行号指向**审计时的版本**，改动后可能偏移。
> 审计边界（初版）：未执行 `npm run typecheck` / `npm run build`（当时沙箱无法启动 pwsh，且构建会写入 `.next`、`tsconfig.tsbuildinfo`）。所有结论都可按文中的 `文件:行号` 复核。

---

## 一、结论摘要

| 分类 | 条目 | 说明 |
| --- | --- | --- |
| A. 多余 / 应删除 | 25 条 | 其中 P0=1、P1=7、P2=17 |
| B. 未完成 / 需续写 | 16 条 | 其中 P0=5、P1=5、P2=6 |

整体判断：**功能主线（OCR → 核对 → 批改 → 报告 → 错题本 → 档案 → 导入导出）已经闭环**，交互与兜底细节完成度较高。遗留问题集中在两处：

1. **从「本机单人工具」迁移到「账号 + 服务器存储」后没有收尾**：文案、事件、存储统计、鉴权、文档仍停留在旧架构（A20–A25、B1、B4、B6、B7）。
2. **桌面 / 便携 exe 时代的大量残留**：依赖、注释、部署目录、环境变量、gitignore 规则（A1–A4、A23）。

最需要优先处理的是 **B1（AI 接口无鉴权）** 与 **B2（报告落盘无校验）**：账号体系已经上线，但这两个口子让「有账号」形同虚设。

---

## 二、A. 多余 / 应删除

优先级：**P0** 影响正确性或安全；**P1** 影响体验或维护；**P2** 清洁度。
处理动作：**删** = 直接移除；**改** = 改写/合并；**核** = 需你确认业务意图后再动。

### A1. 依赖与构建残留

| 编号 | 位置 | 证据 | 处理 | 优先级 |
| --- | --- | --- | --- | --- |
| A1 | `package.json:20-21` | `@radix-ui/react-slot`、`class-variance-authority` 全仓无任何 import（`components/ui` 目录也不存在），是 shadcn 初始化残留 | 删依赖 + `npm install` 更新 lock | P1 |
| A2 | `next.config.mjs:7`、`next.config.mjs:11` | `:7` 注释提到 `npm run build:exe`，该脚本在 `package.json` 中不存在；`:11` 注释「和桌面 exe『关于』保持一致」 | 改注释（保留 `NEXT_PUBLIC_APP_VERSION` 功能） | P2 |
| A3 | `.gitignore:1-12` | 缺少 `data/`（`lib/server/store.ts:29-31` 默认 `./data`，会写入 `users.json`、密码哈希、`sessions.json`、全部报告）与 `.env.production`（`deploy/README.md:58` 要求在仓库根创建） | 改：补 `/data/`、`.env.production` | P1 |
| A4 | `node_modules/electron`、`.next/`、`tsconfig.tsbuildinfo` | 三者都存在但已被 `.gitignore` 覆盖；`package-lock.json` 根依赖中已无 electron | 工作区清理：`npm ci` + `npm run clean` | P2 |

### A2. 死代码 / 未使用导出

| 编号 | 位置 | 证据 | 处理 | 优先级 |
| --- | --- | --- | --- | --- |
| A5 | `lib/constants.ts:192`、`:197`、`:201` | `DEFAULT_TOPIC`、`findTopic()`、`defaultMeta()` 全仓无调用（题目选择已改为 `TOPICS[exam][kind]` + `"custom"`） | 删三个导出 | P2 |
| A6 | `lib/image.ts:70` | `formatBytes()` 无调用（页面都直接写 `x MB`） | 删函数 | P2 |
| A7 | `components/logo.tsx:3` | `compact` 参数三处调用（`site-header`、`site-footer`、`login`）都未传 | 删参数与分支 | P2 |
| A8 | `app/history/page.tsx:202` | `const latest = reports[0]` 声明后从未被使用 | 删变量 | P2 |
| A9 | `lib/storage.ts:105`；`app/mistakes/page.tsx:53`；`app/history/page.tsx:66` | `yanmo:compact-changed` 只有派发没有监听；`yanmo:reports-changed` 只有监听没有派发。三处事件是**单边死链接** | 见 B6：`reports-changed` 应补齐派发（否则导入后列表不刷新）；`compact-changed` 要么补监听，要么删派发 | P1 |
| A10 | `app/grade/page.tsx:531-532` | `const needsSetup = showSetupNotice;` 等价别名，两处都只用于同一个判断 | 改：合并为一个变量 | P2 |
| A11 | `app/grade/page.tsx:694`、`:1025`、`:1266` | 三条 `eslint-disable-next-line @next/next/no-img-element`，但项目无 ESLint 依赖与配置，指令无效 | 见 B12：装 ESLint 就保留，不装就删 | P2 |

### A3. 重复实现（合并，不是硬删）

| 编号 | 位置 | 证据 | 处理 | 优先级 |
| --- | --- | --- | --- | --- |
| A12 | `lib/server/validate.ts:14-25` 与 `:27-38` | `parseOcrBody` / `parseTopicBody` 除提示文案外**逐行相同**（正则、长度上限 9_000_000 均一致） | 改：抽 `parseImageBody(body, label)` | P2 |
| A13 | `lib/utils.ts:12` 与 `components/report/annotated-essay.tsx:29` | `sortAnnotationsByPosition()` 与 `placeAnnotations()` 都在做「把 quote 定位回原文」，算法不同（全文 `indexOf` vs 逐段游标扫描），同一份数据可能得出不同顺序与不同可定位集合 | 改：统一为逐段扫描结果，排序与渲染共用一份 | P1 |
| A14 | `lib/server/validate.ts:5-7`；`lib/constants.ts:13-27` | 枚举 `EXAMS/KINDS/LEVELS` 两处各写一份；`MAX_REPORTS` 在 `lib/constants.ts:214` 与 `lib/server/store.ts:10` 各写一份；`PublicUser` 在 `lib/server/auth.ts:37` 与 `lib/user-data.ts:41` 各写一份 | 改：常量与类型单一来源（server 从 `lib/constants` 派生） | P2 |
| A15 | `app/grade/page.tsx:367-389` 与 `:491-514` | `startRecognition()` 与 `retryRecognition()` 内部 OCR 调用段几乎重复（设置状态 → `apiOcr` → 成功/失败分支） | 改：抽 `runOcr(image)` | P2 |
| A16 | `app/api/grade/route.ts:8-23`、`app/api/ocr/route.ts:8-23`、`app/api/topic/route.ts:8-23`、`app/api/ai/test/route.ts:7-15`、`app/api/reports/route.ts:18-37` 等 | 每个路由都手写「`request.json()` + try/catch → `AppError(400,"BAD_REQUEST")` + `errorResponse`」样板 | 改：抽 `readJsonBody(request)` / `withHandlers()` | P2 |

### A4. 样式与主题冗余

| 编号 | 位置 | 证据 | 处理 | 优先级 |
| --- | --- | --- | --- | --- |
| A17 | `app/globals.css:73-78` 与 `:88-90` | `html { scroll-behavior: smooth; }` 重复声明两遍 | 删后一处 | P2 |
| A18 | `app/globals.css:172`、`:212`、`:234`、`:238`、`:305`、`:388`、`:422`、`:426`、`:442`、`:468`、`:476`、`:484`、`:488`、`:539` | 以下类全仓无使用点：`wrap-narrow`、`serif`/`kai`、`vertical-cn`、`hairline`、`btn-jade`、`chip-active`、`tape`、`link-arrow`、`stat-divider`、`focus-line`、`score-em`、`text-balance`、`no-scrollbar`、`print-page` | 删（`serif`/`kai` 若保留语义需明确注释） | P2 |
| A19 | `app/globals.css:15`、`:17`、`:20`；`tailwind.config.ts:25`、`:29`、`:43`、`:45-47`、`:77`、`:79-80` | 变量 `--jade-light`、`--cinnabar-light`、`--line-soft` 无使用；tailwind 里 `jade.light`、`cinnabar.light`、`boxShadow.seal`（值为 `none`）、`borderRadius.xs`、动画 `fade`/`drift`/`stroke` 也无使用（`rise`、`spread`、`blink` 在用） | 删 | P2 |

### A5. 过时文案与文档（与当前架构矛盾，必须处理）

| 编号 | 位置 | 证据 | 处理 | 优先级 |
| --- | --- | --- | --- | --- |
| A20 | `app/grade/page.tsx:865` | 「作文正文不落库」——但 `GradeResult.text` 会随报告由 `lib/server/store.ts:171-179` 整份写入 `data/reports/<userId>.json` | 改文案（说明正文随报告存账号）或改行为，二选一 | P0 |
| A21 | `app/report/[id]/page.tsx:421`、`:181`；`app/error.tsx:31`；`app/not-found.tsx:15` | 分别写「已存入本机」「报告默认保存在当前浏览器中」「本机报告一般不受影响」「报告只保存在本机」——报告已改为账号存服务器 | 改文案 | P1 |
| A22 | `app/history/page.tsx:376`、`:583`；`app/settings/page.tsx:56`、`:79-89`、`:219-220`、`:686` | 「本地最多保存 100 篇」「更换浏览器或清除站点数据会导致档案丢失」过时；`navigator.storage.estimate()` 统计的是**浏览器**存储，报告已不在浏览器里，右侧栏却显示「本机缓存 · 约 X MB」 | 删 `refreshStorageEstimate`/`storageMb` 相关逻辑，文案改为「账号云端」 | P1 |
| A23 | `README.md:115`、`:36`、`:154-155`、`:157-177` | `:115`「本项目没有登录与权限系统」与已实现的账号体系正面冲突；`:36`「浏览器打开即可使用」但 `middleware.ts:19` 要求登录；`:154-155` 标题「## 项目结构」重复两次；`:157-177` 结构清单漏 `lib/mistakes.ts`、`lib/self-check.ts`、`lib/image.ts`、`lib/client-api.ts`、`components/report/*` | 改：重写「关于接口安全」「账号与数据」「项目结构」三节 | P1 |
| A24 | `deploy/README.md:3-4`；`deploy/env.example:15`、`:18-19`；`deploy/bootstrap.sh:51`；`deploy/systemd/yanmo.service:33` | `deploy/README` 两行「> 目标」并存（第一行是 exe 时代）；`YANMO_PUBLIC_URL` 全仓无引用（原用于生成 `latest.json` 与下载链接）；`:15` 与 systemd `:33` 注释「云备份密文」不符现状；bootstrap 创建 `public/downloads`、`public/updates` 空目录 | 删/改 | P2 |
| A25 | `public/icons/icon-maskable-512.png`；`app/icon.svg`；`app/layout.tsx:15-21` | maskable 图标无任何引用（没有 `manifest`）；`app/icon.svg` 与 layout 声明的 png 图标重复表达同一件事 | 核：补 PWA manifest 或删 maskable；favicon 二选一 | P2 |

> 注：编号 A1–A25，与摘要「25 条」对应。A9 与 B6、A13 与 B10 互为因果，实施时一并处理。

---

## 三、B. 未完成 / 需续写

### P0（安全与数据正确性）

**B1. AI 接口没有鉴权 —— 账号体系形同虚设**
- 位置：`app/api/ocr/route.ts`、`app/api/topic/route.ts`、`app/api/grade/route.ts`、`app/api/ai/test/route.ts`（四个文件都只做 `requireAi(request)`，没有 `requireUser`）。
- 现状：`lib/server/ai.ts:58-99` 在请求头没有 Key 时**回落到环境变量 Key**。一旦部署时配了 `AI_API_KEY`，任何未登录访客都能直接 `curl` 这几个接口消耗额度（`deploy/nginx/yanmo.conf:65-76` 的限流是唯一防线）。
- 续写要点：使用服务端 Key（`ai.source === "env"`）或统一策略时强制 `await requireUser(request)`；抽 `withUser(request, handler)` 包装，保留浏览器自带 Key 的 BYOK 路径。

**B2. 报告落盘零校验**
- 位置：`app/api/reports/route.ts:27-33`（只判断 `report.id` 是字符串就整份写入）、`app/api/reports/import/route.ts:18-22`（只 `slice(0,500)`，不逐条校验）。
- 现状：`lib/server/store.ts:171-179` 原样 `JSON.stringify` 落盘；`GradeResult.text` 长度、`annotations` 条数、`score.total` 范围都不设限，`MAX_REPORTS=100` 只限制篇数不限制单篇体积。
- 续写要点：把 `lib/storage.ts:109-125` 的 `isGradeResult` 抽到 `lib/server/validate.ts`（共享层），补 `text ≤ 6000`、`annotations ≤ 30`、`version === 1`、`meta.maxScore === maxScoreFor(...)`、单篇 JSON ≤ 200KB 上限；导入接口逐条过滤并返回 `invalid` 计数。

**B3. 个人资料分数未夹取**
- 位置：`app/api/profile/route.ts:31-36`。
- 现状：`targetScore` 只判断「是有限数字」，不按 `maxScoreFor(exam, "essay")` 夹取，也不取 0.5 倍数；客户端 `app/settings/page.tsx:193-199` 也无法防御直接调接口。
- 续写要点：与 `lib/server/validate.ts:90-93` 的批改参数保持同一套夹取规则。

**B4. 生产环境强制 Secure Cookie 与「HTTP 验收」自相矛盾**
- 位置：`lib/server/auth.ts:26`、`:33`（`NODE_ENV === "production"` 时追加 `Secure`）；`deploy/README.md:90-91` 建议无域名时用 `http://服务器IP:8080` 验收。
- 现状：该验收路径下浏览器会丢弃 Cookie，登录「成功」却不生效，表现为无限跳回 `/login`。
- 续写要点：改为按 `X-Forwarded-Proto` 或新增 `YANMO_SECURE_COOKIES` 开关决定；或在文档中明确「生产必须 HTTPS，HTTP 仅本地开发」。

**B5. `/login?next=` 未校验，存在开放重定向**
- 位置：`app/login/page.tsx:15`（`params.get("next") || "/"`）、`:39`（`router.replace(next)`）。
- 现状：`next` 完全取自 query，`//evil.com` 或绝对 URL 会被直接用于路由替换（行为随 Next 版本不同，但绝不应信任）。
- 续写要点：仅允许以 `/` 开头且不以 `//` 开头的路径，否则回退 `/`。

### P1（功能闭环缺口）

**B6. 导入后列表不刷新（`reports-changed` 事件只监听不派发）**
- 位置：`app/history/page.tsx:168-185`（`confirmImport` 成功后只写提示，不更新 `reports`）；对照 `:66` 的监听。
- 现状：导入完报告数、列表、趋势图全是旧数据，必须手动刷新页面；`app/mistakes/page.tsx:53` 的监听同样永远不触发。
- 续写要点：导入/清空/删除成功后 `window.dispatchEvent(new CustomEvent("yanmo:reports-changed"))`，或在 `confirmImport` 内直接重新 `fetchReports()`；两个页面保留监听即可生效。

**B7. 401 全链路被吞，登录过期显示成「报告丢了」**
- 位置：`lib/user-data.ts:81-84`（`fetchReport` 先拉全量再 find）、`app/report/[id]/page.tsx:105-114`（失败即 `setReport(null)`）、`app/grade/page.tsx:418-421`（`catch(() => null)` 后继续批改，保存时才失败）。
- 现状：会话过期时用户看到的是 A21 里那句「报告保存在当前浏览器」——误以为数据丢失。
- 续写要点：（a）统一处理 `ApiError.status === 401` → `router.replace("/login?next=" + pathname)`；（b）新增 `GET /api/reports/[id]` 单篇接口，`fetchReport` 直连（顺带解决报告页每次都要下载整份档案的性能问题：100 篇 × 每篇十几 KB 的 JSON）。

**B8. 破坏性操作静默失败**
- 位置：`app/settings/page.tsx:213-221`（`handleClearReports` 的 `catch {}`）、`app/report/[id]/page.tsx:391-399`（`handleDelete` 的 `catch {}`）。
- 现状：请求失败也照样 `setReportCount(0)` / `router.push("/history")`，用户以为删掉了。
- 续写要点：失败时保留原状态并给出错误提示（复用 `ClientApiError`/`ApiError.message`）。

**B9. 首次使用提示不识别服务端 Key**
- 位置：`components/first-run-hint.tsx:18-34`。
- 现状：只检查 `loadAiConfig()`（浏览器 Key）与报告数；服务端已配好 `AI_API_KEY` 时仍提示「先到设置接入 AI」，与 `app/grade/page.tsx:531` 的判断（已考虑 `status.serverConfigured`）不一致。
- 续写要点：并行调用 `fetchAiStatus()`，`serverConfigured` 为真则不展示。

**B10. 无法在原文定位的批注被静默丢弃**
- 位置：`components/report/annotated-essay.tsx:40-47`。
- 现状：`paragraph.indexOf(quote) === -1` 时直接 `return`，但右侧批注列表仍按序号展示、`filteredAnnotations.length` 仍计入「N 处标记」——出现「列表有第 7 条、正文里找不到 7」的不一致。
- 续写要点：返回未定位集合，在批注卡片上标「原文中未找到该片段（可能被改写/含特殊字符）」，或从统计与序号中排除。

### P2（工程化缺口）

**B11. 导入的数据版本无迁移出口**
- 位置：`lib/types.ts:63`（`version: 1`）、`:89`（`source: "ai"`）。
- 现状：`version`/`source` 字段无人读取，`mergeReports` 不校验版本，未来结构升级无迁移入口。
- 续写要点：导入时校验 `version`，非 1 走 `migrateReport()`（哪怕先只做「不认识则拒绝并计数」）。

**B12. 无 ESLint / 无测试**
- 位置：`package.json:7-15`（只有 `dev`、`build`、`typecheck` 等，无 `lint`/`test`）；但代码里写了 3 条 ESLint 指令（A11）。
- 续写要点：二选一 —— 补 `eslint` + `eslint-config-next` + `npm run lint`（`next build` 也会自动接入），或删指令并在 README 注明「本项目不做 lint」。

**B13. `tsconfig.json` 目标停留在 ES5**
- 位置：`tsconfig.json:3`。
- 现状：Next 14 默认 `ES2017`，`ES5` 会多出一层降级（体积与调试体验都受影响），且 `lib: esnext` 与 `target: ES5` 组合容易被误用。
- 续写要点：上调 `target` 后跑 `npm run typecheck` 与 `npm run build` 确认无回归。

**B14. PWA 只做了一半**
- 位置：`public/icons/icon-maskable-512.png`（无引用）、`app/layout.tsx:15-21`（只声明 icon/apple）。
- 续写要点：补 `app/manifest.ts`（含 maskable 图标、`start_url`、`display: standalone`）并链接；或删 maskable 图标，明确不做 PWA。

**B15. 过期会话只在一个入口清理**
- 位置：`lib/server/store.ts:118-133`（仅在 `createSession` 时过滤过期项）。
- 现状：用户长期不登录时 `sessions.json` 持续增长；`destroySession` 只删当前 token。
- 续写要点：`getSessionUser` 命中过期时顺手触发一次 prune，或在进程启动时清理一次。

**B16. 两份环境变量示例不一致**
- 位置：根 `.env.example`（含 `AI_VISION_MODEL`、`AI_TEXT_MODEL`、`AI_JSON_MODE`）与 `deploy/env.example`（只有 `AI_MODEL`）。
- 现状：代码 `lib/server/ai.ts:78-84` 与 `:154` 支持拆分模型与 JSON 开关，部署文档却没提，运维时容易漏配。
- 续写要点：`deploy/env.example` 补齐三项并写明用途；同时删掉 A24 中的 `YANMO_PUBLIC_URL`。

---

## 四、建议实施顺序

**批次 0：文档与死代码（风险最低，先清场）**
- 依赖与死代码：A1–A8、A10、A12、A14–A19、A22、A24、A25
- 归入后续批次：A9/A13 → 批次 2（与 B6/B10 同源）；A11 → 批次 3（与 B12 一起决定 ESLint 去留）；A20/A21/A23 → 批次 3 文案重写
- 验证：`npm ci && npm run typecheck && npm run build`；手工跑一遍全部页面确认无样式/布局回归（尤其 `app/globals.css` 删类后）。

**批次 1：安全收口（最高价值）**
- B1 → B2 → B3 → B5 → B4
- 验证：未登录状态直接 `curl -X POST /api/grade` 必须 401；伪造 100KB 报告 / 缺字段报告必须 400；`/login?next=https://example.com` 必须回退 `/`；HTTP 验收路径的登录态按 B4 结论复现。

**批次 2：功能闭环**
- B6 → B7（含 `GET /api/reports/[id]`）→ B8 → B9 → B10
- 增加 A9/A13 的合并（事件与批注定位统一后，B6/B10 才有单一实现可依）。
- 验证：历史页导入后列表立即变化；手动清 cookie 后打开 `/report/<id>` 应跳 `/login` 而不是「报告不存在」；含引号/换行的批注在正文中能定位。

**批次 3：工程化与文案**
- B11–B16，以及 A20、A21、A23 的文案重写。
- 验证：`README.md` 通读无自相矛盾；`deploy/README.md` 按步骤在空机上走通（可先只看参数一致性）。

回归清单（每批次都跑）：注册/登录/登出 → 手写照片识别 → 文字稿批改 → 报告页（筛选、练习模式、简洁模式、打印）→ 错题本（筛选、练习）→ 写作档案（搜索、排序、导入、导出、趋势）→ 设置（保存测试连接、个人水平、清空报告）。

---

## 五、附：整体评价（供参考，不属于待办）

- 提示词工程（`lib/server/prompt.ts`）与归一化兜底（`lib/server/normalize.ts`）是这份代码里最扎实的部分：字段别名、中文/英文枚举兼容、分数夹取、空内容与 `finish_reason` 诊断都考虑到了。
- `lib/server/store.ts` 的原子写（`writeJsonAtomic`）与进程内串行队列（`serialize`）思路正确，单实例部署够用；多实例/多进程部署时不成立，目前 `deploy/` 也是单 systemd 实例，属于已知边界。
- 交互细节（草稿自动保存、练习模式 sessionStorage、拖拽与粘贴、`[` `]` 快捷键、打印样式）完成度明显高于一般同类项目，这些不是问题，反而是应当保留的复杂度。

---

## 六、实施状态（2026-11-17）

四个批次已全部实施。验证方式：`npm run lint`（0 warning / 0 error）、`npm run typecheck`、`npm run build`，以及本地 dev server（端口 3100，`YANMO_DATA_DIR` 指向临时目录）上的接口回归。

### 批次 0：清理（已完成）

- **A1** 移除 `@radix-ui/react-slot`、`class-variance-authority`，`package-lock.json` 同步（npm 顺带剪除 275 个不再需要的包，electron 等旧残留一并消失）。
- **A2** `next.config.mjs` 注释改为 `prepare:standalone`，删掉 `build:exe` / 桌面 exe 表述。
- **A3** `.gitignore` 增加 `/data/`、`.env.production`，移除 `dist-electron`、`.shots`。
- **A4** `npm run clean` 清理旧 `.next` 与 `tsconfig.tsbuildinfo`。
- **A5/A6/A7/A8/A10** 删除 `DEFAULT_TOPIC`/`findTopic`/`defaultMeta`、`formatBytes`、`Logo` 的 `compact` 参数、写作档案未使用的 `latest`、`grade` 页 `needsSetup` 别名。
- **A12** 作文图/题目图校验合并为 `parseImageBody(body, label)`。
- **A14** 枚举单一来源：`validate.ts` 的 EXAMS/KINDS/LEVELS 改为从 `lib/constants` 派生；`MAX_REPORTS` 只保留在 constants；`PublicUser` 迁入 `lib/types.ts`。
- **A15** `grade` 页 OCR 调用抽为 `runRecognition(image)`，`startRecognition` / `retryRecognition` 共用。
- **A16** 8 个 API 路由改用 `readJsonBody(request)`，删除重复的 JSON 解析样板。
- **A17/A18/A19** 删除重复 `scroll-behavior`、14 个无引用 CSS 类、未使用变量与 tailwind 令牌（`jade.light`、`cinnabar.light`、`boxShadow.seal`、`borderRadius.xs`、`fade`/`drift`/`stroke` 动画、`font-display`/`font-kai` 族）。
- **A22** 设置页删除 `navigator.storage.estimate()` 估算（报告已不在浏览器），写作档案「本地最多保存」「清除站点数据会丢档案」改为账号云端表述。
- **A24** `deploy/README.md` 删除重复目标行；`deploy/env.example` 删除 `YANMO_PUBLIC_URL` 并修正数据目录注释；`bootstrap.sh` 删除 `public/downloads|updates`；systemd 注释改为账号/会话/报告。
- **A25** 删除 `public/icons/icon-maskable-512.png` 与 `app/icon.svg`，`layout.tsx` 的 png 图标成为唯一来源；PWA manifest 在批次 3 补齐。

### 批次 1：安全收口（已完成，接口实测）

- **B1** `/api/ocr|topic|grade|ai/test` 增加 `requireUser`；实测未登录返回 `401 UNAUTHORIZED`。
- **B2** 新增 `lib/server/report.ts`：校验 `version===1`、`id` 长度、`createdAt`、`meta` 枚举与满分、`score.total` 范围、`annotations ≤ 30`、`text ≤ 6000`、单篇 ≤ 200KB；实测 7000 字符正文与 31 条批注均返回 `400 BAD_REPORT`。导入接口逐条过滤并返回 `invalid` 计数（实测 `invalid: 1`），客户端提示「N 条记录格式无效，已忽略」。
- **B3** `/api/profile` 的目标分按 `maxScoreFor(exam,"essay")` 夹取并取 0.5 倍数；实测 `english2 + 999` → `15`。
- **B4** Cookie `Secure` 改为按请求协议判断（含 `X-Forwarded-Proto`），支持 `YANMO_SECURE_COOKIES=always|never` 覆盖；实测 http 请求不带 `Secure`、带 `X-Forwarded-Proto: https` 时带 `Secure`。
- **B5** `/login?next=` 仅接受以单个 `/` 开头的站内路径，其余回退 `/`。

### 批次 2：功能闭环（已完成，接口/单元实测）

- **B6 + A9** 导入成功后立即 `refreshReports()`；删除从未触发的 `yanmo:reports-changed` 监听（history/mistakes）与无消费者的 `yanmo:compact-changed` 派发。
- **B7** 新增 `GET /api/reports/[id]`（实测 200 / 404 / 401），`fetchReport` 改为单篇拉取；新增 `components/session-guard.tsx`，任意接口 401 时统一跳 `/login?next=<当前路径>`。
- **B8** 清空报告、删除报告失败不再静默：设置页 `dataError`、报告页 `deleteError` 会提示具体原因。
- **B9** 首用提示同时检查 `/api/status`，服务端已配 Key 时不再提示「去接入」。
- **B10 + A13** 批注定位统一到 `lib/utils.ts` 的 `placeAnnotations` / `splitEssayParagraphs`，`AnnotatedEssay` 与 `sortAnnotationsByPosition` 共用；报告页显示「原文未定位」标记与说明，正文标记数改为实际定位数。已用 Node 单测覆盖：重复引文顺序匹配、未定位收集、排序顺序。

### 批次 3：工程化与文案（已完成，构建验证）

- **B11** `parseReport` 拒绝非 `version: 1` 的报告，导入按 invalid 计数（迁移入口已具备）。
- **B12 + A11** 引入 ESLint 8 + `eslint-config-next`，新增 `npm run lint`（当前 0 warning / 0 error）；原先 3 条 `eslint-disable` 指令因此生效。lint 还发现并修正了 `useSecureCookie` 误用 Hook 命名的问题。
- **B13** `tsconfig.json` target 由 ES5 升至 ES2020，typecheck 与 build 均通过。
- **B14** 新增 `app/manifest.ts`，构建产物包含 `/manifest.webmanifest`。
- **B15** 过期会话在 `getSessionUser` 读取时顺带 `pruneSessions`，避免 `sessions.json` 累积。
- **B16** `deploy/env.example` 补齐 `AI_VISION_MODEL`、`AI_TEXT_MODEL`、`AI_JSON_MODE`。
- **A20/A21/A23** 「作文正文不落库」改为「报告含原文，存账号下」；报告页/错误页/404/全局错误页与 README 的「本机存储」表述统一改为账号云端；README 删除重复标题、补全项目结构与 lint 脚本。

### 仍建议后续处理（不阻塞）

- 自动化测试仍是空白：本次只有一次性的 Node 单测与接口手测，建议补 `node:test` 或轻量集成测试（`parseReport`、`placeAnnotations`、鉴权矩阵）。
- `lib/server/store.ts` 仍是单实例文件存储（原子写 + 进程内串行队列），多实例部署需要换数据库或加锁。
- 报告正文会随报告存储，如需「不留原文」需产品层面另做脱敏/加密。
