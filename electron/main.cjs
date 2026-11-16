const { app, BrowserWindow, Menu, dialog, screen, shell, nativeTheme } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

// 固定端口可以让 localStorage 的 origin 保持稳定，报告和设置才不会每次启动都丢失。
const DEFAULT_PORT = 38217;
const PORT = Number(process.env.YANMO_PORT) || DEFAULT_PORT;
const CAPTURE_PATH = process.env.YANMO_CAPTURE_PATH || "";
const RELEASES_URL = "https://github.com/initialize-ye/YanMo/releases/latest";

const MIN_WIDTH = 960;
const MIN_HEIGHT = 640;
const DEFAULT_WIDTH = 1320;
const DEFAULT_HEIGHT = 920;

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let serverLogs = "";
let logStream = null;
let updateCheckInFlight = false;
let isQuitting = false;

app.setName("YanMo");
// Windows 任务栏/通知的应用标识，保证分组与更新提示归到同一图标。
app.setAppUserModelId("com.yanmo.app");
// 应用为浅色纸质主题，固定原生主题为浅色，避免系统深色模式下滚动条、右键菜单等错配。
nativeTheme.themeSource = "light";
app.setPath("userData", path.join(app.getPath("appData"), "YanMo"));
const LOG_DIR = path.join(app.getPath("userData"), "logs");
const LOG_FILE = path.join(LOG_DIR, "server.log");
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.focus();
      return;
    }
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(bootstrap).catch(handleFatal);
}

function prepareLog() {
  if (logStream) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    // 日志过大时轮转一次，避免 server.log 无限增长。
    try {
      if (fs.statSync(LOG_FILE).size > 2 * 1024 * 1024) {
        const backup = `${LOG_FILE}.1`;
        try {
          fs.rmSync(backup, { force: true });
        } catch {}
        fs.renameSync(LOG_FILE, backup);
      }
    } catch {}
    logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
    logStream.write(`\n--- ${new Date().toISOString()} ---\n`);
  } catch {}
}

function appendLog(chunk) {
  const text = chunk.toString();
  serverLogs = (serverLogs + text).slice(-24000);
  prepareLog();
  try {
    logStream?.write(text);
  } catch {}
}

function closeLog() {
  try {
    logStream?.end();
  } catch {}
  logStream = null;
}

/* ---------------- 窗口状态：尺寸、位置、最大化和缩放 ---------------- */

function readWindowState() {
  const fallback = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: undefined,
    y: undefined,
    maximized: false,
    zoom: 0
  };
  let stored = null;
  try {
    stored = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return fallback;
  }
  if (!stored || typeof stored !== "object") return fallback;

  const width = Number(stored.width);
  const height = Number(stored.height);
  const x = Number(stored.x);
  const y = Number(stored.y);
  const zoom = Number(stored.zoom);

  const bounds = {
    width: Number.isFinite(width) && width >= MIN_WIDTH ? Math.round(width) : DEFAULT_WIDTH,
    height: Number.isFinite(height) && height >= MIN_HEIGHT ? Math.round(height) : DEFAULT_HEIGHT,
    x: Number.isFinite(x) ? Math.round(x) : undefined,
    y: Number.isFinite(y) ? Math.round(y) : undefined,
    maximized: stored.maximized === true,
    zoom:
      Number.isFinite(zoom) && zoom >= -3 && zoom <= 3
        ? Math.round(zoom * 10) / 10
        : 0
  };

  // 上次的窗口可能落在已经拔掉的显示器上，这时回到默认位置。
  if (bounds.x !== undefined && bounds.y !== undefined) {
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      const overlapX = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
      const overlapY =
        Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
      return overlapX > 120 && overlapY > 80;
    });
    if (!visible) {
      bounds.x = undefined;
      bounds.y = undefined;
      bounds.width = DEFAULT_WIDTH;
      bounds.height = DEFAULT_HEIGHT;
    }
  }

  return bounds;
}

let windowStateTimer = null;

function writeWindowState(window) {
  if (!window || window.isDestroyed()) return;
  try {
    const zoom = window.webContents.getZoomLevel();
    const maximized = window.isMaximized();
    // getNormalBounds 在最大化时也返回"还原后"的尺寸，始终记录几何信息更稳。
    const { x, y, width, height } = window.getNormalBounds();
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ x, y, width, height, maximized, zoom }, null, 2)
    );
  } catch {}
}

// 拖动/缩放/最大化时防抖保存，避免只在关闭时才落盘（意外崩溃也能记住）。
function scheduleWriteWindowState(window) {
  if (windowStateTimer) clearTimeout(windowStateTimer);
  windowStateTimer = setTimeout(() => {
    windowStateTimer = null;
    writeWindowState(window);
  }, 500);
}

/* ---------------- 启动画面 ---------------- */

function createSplash() {
  if (CAPTURE_PATH) return;
  try {
    splashWindow = new BrowserWindow({
      width: 380,
      height: 220,
      frame: false,
      resizable: false,
      show: false,
      center: true,
      skipTaskbar: true,
      // 启动瞬间不抢占前台焦点，等主窗口就绪再显示，避免打断用户当前操作。
      focusable: false,
      alwaysOnTop: true,
      backgroundColor: "#f8f9fa",
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    splashWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;font-family:"Microsoft YaHei","Segoe UI",sans-serif;background:#f8f9fa;color:#1f1f1f;display:flex;align-items:center;justify-content:center;flex-direction:column;user-select:none}
  .logo{width:56px;height:56px;border-radius:14px;background:#1a73e8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:600;letter-spacing:0}
  .name{margin-top:16px;font-size:17px;font-weight:500}
  .hint{margin-top:6px;font-size:12px;color:#5e5e5e}
  .bar{margin-top:18px;width:120px;height:3px;border-radius:999px;background:#dadce0;overflow:hidden}
  .bar span{display:block;width:40%;height:100%;border-radius:999px;background:#1a73e8;animation:slide 1.1s ease-in-out infinite}
  @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
</style></head><body>
  <div class="logo">墨</div>
  <div class="name">研墨 AI</div>
  <div class="hint">正在启动本地服务…</div>
  <div class="bar"><span></span></div>
</body></html>`)
    );
    splashWindow.once("ready-to-show", () => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
    });
  } catch {
    splashWindow = null;
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

/* ---------------- 本地服务 ---------------- */

function getServerDir() {
  if (process.env.YANMO_SERVER_DIR) {
    return path.resolve(process.env.YANMO_SERVER_DIR);
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function isYanmoAt(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return false;
    const data = await response.json();
    return typeof data?.serverConfigured === "boolean";
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`服务进程已退出（代码 ${serverProcess.exitCode}）。`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("本地服务启动超时。");
}

async function startServer() {
  const serverDir = getServerDir();
  const serverEntry = path.join(serverDir, "server.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `找不到服务端文件：${serverEntry}\n\n开发模式请先执行：\nnpm run build\nnpm run prepare:standalone`
    );
  }

  if (!(await canListen(PORT))) {
    if (await isYanmoAt(PORT)) {
      return `http://127.0.0.1:${PORT}`;
    }
    throw new Error(`端口 ${PORT} 已被其他程序占用，请关闭占用端口的程序后重试。`);
  }

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  serverProcess.stdout?.on("data", appendLog);
  serverProcess.stderr?.on("data", appendLog);
  serverProcess.once("error", (error) => appendLog(`\n[server error] ${error.message}`));
  serverProcess.once("exit", (code, signal) => {
    appendLog(`\n[server exit] code=${code ?? "null"} signal=${signal ?? "null"}\n`);
    // 非主动退出且非截图模式：本地服务意外停止，提示可重启，避免界面"假死"。
    if (isQuitting || CAPTURE_PATH) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    void dialog
      .showMessageBox(mainWindow, {
        type: "error",
        title: "本地服务已停止",
        message: "研墨的本地服务意外停止",
        detail: `退出代码 ${code ?? "null"}${signal ? `，信号 ${signal}` : ""}。可以尝试重新启动服务，数据保存在本机不会丢失。`,
        buttons: ["重新启动服务", "退出"],
        defaultId: 0,
        cancelId: 1
      })
      .then(async (result) => {
        if (result.response !== 0) {
          app.quit();
          return;
        }
        try {
          const url = await startServer();
          if (mainWindow && !mainWindow.isDestroyed()) await mainWindow.loadURL(url);
        } catch (error) {
          appendLog(`\n[restart failed] ${error.message}\n`);
          dialog.showErrorBox("重启服务失败", String(error?.message ?? error));
        }
      });
  });

  const url = `http://127.0.0.1:${PORT}`;
  await waitForServer(url);
  return url;
}

function stopServer() {
  const child = serverProcess;
  serverProcess = null;
  if (!child || child.killed) return;
  try {
    // Windows 下用 taskkill 结束整个进程树，避免服务子进程残留占用端口。
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill();
    }
  } catch {
    try {
      child.kill();
    } catch {}
  }
}

/* ---------------- 菜单与帮助 ---------------- */

function openUserData() {
  void shell.openPath(app.getPath("userData"));
}

function openLogs() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {}
  void shell.openPath(LOG_DIR);
}

function showShortcuts() {
  const detail = [
    "Ctrl + 1    批改台",
    "Ctrl + 2    错题本",
    "Ctrl + 3    写作档案",
    "Ctrl + 4    设置",
    "",
    "Ctrl + Enter    批改台提交文字",
    "Ctrl + V    在批改台粘贴作文照片",
    "Ctrl + P    打印 / 导出 PDF",
    "",
    "Ctrl + R    重新加载",
    "Ctrl + 加号 / 减号    调整页面缩放（会记住）"
  ].join("\n");
  void dialog.showMessageBox(mainWindow ?? undefined, {
    type: "info",
    title: "常用快捷键",
    message: "研墨 AI 常用快捷键",
    detail,
    buttons: ["知道了"]
  });
}

function showAbout() {
  const detail = [
    `版本 ${app.getVersion()}`,
    `Electron ${process.versions.electron}`,
    `Chromium ${process.versions.chrome}`,
    "",
    `数据目录：${app.getPath("userData")}`,
    `日志文件：${LOG_FILE}`,
    "",
    "评分仅供训练参考，不能替代正式考试阅卷。"
  ].join("\n");
  void dialog.showMessageBox(mainWindow ?? undefined, {
    type: "info",
    title: "关于研墨 AI",
    message: "研墨 AI · 考研英语作文批改",
    detail,
    buttons: ["打开数据目录", "打开日志目录", "关闭"],
    defaultId: 2,
    cancelId: 2
  }).then((result) => {
    if (result.response === 0) openUserData();
    else if (result.response === 1) openLogs();
  });
}

function compareVersions(a, b) {
  const parse = (value) =>
    String(value)
      .replace(/^v/i, "")
      .split(/[.-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((value) => (Number.isFinite(value) ? value : 0));
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function checkForUpdates(silent = false) {
  if (updateCheckInFlight) return;
  updateCheckInFlight = true;
  try {
    await runUpdateCheck(silent);
  } finally {
    updateCheckInFlight = false;
  }
}

async function runUpdateCheck(silent = false) {
  const current = app.getVersion();
  let latest = "";
  try {
    const response = await fetch("https://api.github.com/repos/initialize-ye/YanMo/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "YanMo-Desktop" },
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) {
      const data = await response.json();
      latest = typeof data?.tag_name === "string" ? data.tag_name : "";
    }
  } catch {
    latest = "";
  }

  if (latest && compareVersions(latest, current) > 0) {
    const result = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "info",
      title: "发现新版本",
      message: `当前版本 ${current}，最新版本 ${latest.replace(/^v/i, "")}`,
      detail: "是否打开 GitHub Releases 页面下载新版本？",
      buttons: ["打开下载页", "稍后"],
      defaultId: 0,
      cancelId: 1
    });
    if (result.response === 0) void shell.openExternal(RELEASES_URL);
    return;
  }

  // 静默检查（启动时）没有新版本或获取失败时，不打扰用户。
  if (silent) return;

  if (latest) {
    await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "info",
      title: "检查更新",
      message: "已是最新版本",
      detail: `当前版本 ${current}。`,
      buttons: ["确定"]
    });
    return;
  }

  await dialog.showMessageBox(mainWindow ?? undefined, {
    type: "warning",
    title: "检查更新",
    message: "无法获取更新信息",
    detail:
      `当前版本 ${current}。\n\n` +
      "可能是网络不可用，或仓库为私有。你可以直接打开 Releases 页面查看是否有新版本。",
    buttons: ["打开下载页", "关闭"],
    defaultId: 1,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) void shell.openExternal(RELEASES_URL);
  });
}

function buildMenu() {
  const template = [
    {
      label: "文件",
      submenu: [
        { label: "批改台", accelerator: "CmdOrCtrl+1", click: () => navigate("/grade") },
        { label: "错题本", accelerator: "CmdOrCtrl+2", click: () => navigate("/mistakes") },
        { label: "写作档案", accelerator: "CmdOrCtrl+3", click: () => navigate("/history") },
        { label: "设置", accelerator: "CmdOrCtrl+4", click: () => navigate("/settings") },
        { type: "separator" },
        {
          label: "打印 / 导出 PDF…",
          accelerator: "CmdOrCtrl+P",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.print({ printBackground: true });
            }
          }
        },
        { type: "separator" },
        { label: "打开数据目录", click: openUserData },
        { label: "打开日志目录", click: openLogs },
        { type: "separator" },
        { label: "退出", role: "quit" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", role: "reload", accelerator: "CmdOrCtrl+R" },
        { type: "separator" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { label: "实际大小", role: "resetZoom" },
        { type: "separator" },
        { label: "全屏", role: "togglefullscreen" },
        ...(app.isPackaged
          ? []
          : [{ label: "开发者工具", role: "toggleDevTools", accelerator: "F12" }])
      ]
    },
    {
      label: "帮助",
      submenu: [
        { label: "常用快捷键", click: showShortcuts },
        { type: "separator" },
        { label: "检查更新", click: () => void checkForUpdates() },
        { label: "打开下载页", click: () => void shell.openExternal(RELEASES_URL) },
        { type: "separator" },
        { label: "关于研墨 AI", click: showAbout }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function navigate(pathname) {
  const target = `http://127.0.0.1:${PORT}${pathname}`;
  if (mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.loadURL(target);
  }
}

/* ---------------- 主窗口 ---------------- */

async function createWindow(url) {
  const state = readWindowState();
  const iconPath = path.join(__dirname, "..", "build", "icon.png");

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : {}),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: "#f8f9fa",
    autoHideMenuBar: false,
    title: "研墨 AI",
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 窗口隐藏或最小化时仍保持动画和计时器正常，避免切回来出现半渲染页面。
      backgroundThrottling: false
    }
  });

  if (state.maximized) mainWindow.maximize();
  if (state.zoom) mainWindow.webContents.setZoomLevel(state.zoom);

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    if (CAPTURE_PATH || !mainWindow) return;
    mainWindow.show();
    if (state.maximized) mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(`http://127.0.0.1:${PORT}`)) {
      // 内部链接不另开一个没有菜单和状态的新窗口，直接在当前窗口打开。
      if (mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(target);
      return { action: "deny" };
    }
    if (/^https?:/i.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (target.startsWith(`http://127.0.0.1:${PORT}`)) return;
    // 只把 http(s) 链接交给浏览器；拖入文件等本地地址直接拦下，避免窗口跳走。
    event.preventDefault();
    if (/^https?:/i.test(target)) void shell.openExternal(target);
  });

  // 桌面端需要右键菜单，否则输入框里无法剪切、复制、粘贴。
  mainWindow.webContents.on("context-menu", (_event, params) => {
    const template = [];
    if (params.isEditable) {
      template.push(
        { role: "cut", label: "剪切", enabled: params.editFlags.canCut },
        { role: "copy", label: "复制", enabled: params.editFlags.canCopy },
        { role: "paste", label: "粘贴", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { role: "selectAll", label: "全选", enabled: params.editFlags.canSelectAll }
      );
    } else if (params.selectionText.trim()) {
      template.push({ role: "copy", label: "复制", enabled: params.editFlags.canCopy });
    }
    if (!template.length) return;
    Menu.buildFromTemplate(template).popup({ window: mainWindow ?? undefined });
  });

  // 页面加载失败时给出可操作的提示，而不是空白窗口。
  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedURL, isMainFrame) => {
    // 忽略子框架/子资源失败，以及被新导航取消产生的 ERR_ABORTED（-3），这些属正常。
    if (!isMainFrame) return;
    if (code === -3) return;
    appendLog(`\n[did-fail-load] ${code} ${description} ${validatedURL}\n`);
    if (CAPTURE_PATH) return;
    closeSplash();
    void dialog
      .showMessageBox(mainWindow ?? undefined, {
        type: "error",
        title: "页面加载失败",
        message: "无法打开研墨界面",
        detail: `${description}（${code}）\n\n可以尝试重新加载，或查看日志目录排查。`,
        buttons: ["重新加载", "打开日志目录", "退出"],
        defaultId: 0,
        cancelId: 2
      })
      .then((result) => {
        if (result.response === 0) void mainWindow?.loadURL(url);
        else if (result.response === 1) openLogs();
        else app.quit();
      });
  });

  // 渲染进程崩溃时给出可操作提示，而不是留下空白窗口。
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appendLog(`\n[render-process-gone] reason=${details?.reason ?? "unknown"}\n`);
    if (CAPTURE_PATH) {
      app.quit();
      return;
    }
    closeSplash();
    void dialog
      .showMessageBox(mainWindow ?? undefined, {
        type: "error",
        title: "界面已中断",
        message: "研墨界面出现异常并已停止",
        detail: `原因：${details?.reason ?? "未知"}。重新加载通常可以恢复，数据保存在本机不会丢失。`,
        buttons: ["重新加载", "退出"],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) void mainWindow?.reload();
        else app.quit();
      });
  });

  // 卡顿/无响应时提示，可重新加载恢复。
  mainWindow.on("unresponsive", () => {
    appendLog("\n[unresponsive] 主界面无响应\n");
    if (CAPTURE_PATH) return;
    void dialog
      .showMessageBox(mainWindow ?? undefined, {
        type: "warning",
        title: "界面无响应",
        message: "研墨界面暂时没有响应",
        detail: "可以稍等片刻让它恢复，或重新加载页面。",
        buttons: ["重新加载", "继续等待"],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) void mainWindow?.reload();
      });
  });

  for (const eventName of ["resize", "move", "maximize", "unmaximize"]) {
    mainWindow.on(eventName, () => scheduleWriteWindowState(mainWindow));
  }

  mainWindow.on("close", () => writeWindowState(mainWindow));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);

  if (CAPTURE_PATH) {
    setTimeout(async () => {
      try {
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(CAPTURE_PATH, image.toPNG());
      } catch (error) {
        console.error(error);
      } finally {
        app.quit();
      }
    }, 3200);
  }
}

async function bootstrap() {
  prepareLog();
  appendLog(
    `\n[start] v${app.getVersion()} electron=${process.versions.electron} node=${process.versions.node} packaged=${app.isPackaged}\n`
  );
  try {
    appendLog(`[start] serverDir=${getServerDir()} port=${PORT}\n`);
  } catch {}
  buildMenu();
  createSplash();
  const url = await startServer();
  await createWindow(url);
  // 打包版启动后静默检查一次更新，仅在发现新版本时提示。
  if (app.isPackaged && !CAPTURE_PATH) {
    setTimeout(() => void checkForUpdates(true), 8000);
  }
}

function handleFatal(error) {
  console.error(error);
  const raw = String(error?.message ?? error);
  const detail = serverLogs ? `${raw}\n\n${serverLogs}` : raw;
  appendLog(`\n[fatal] ${detail}\n`);
  closeSplash();
  if (CAPTURE_PATH) {
    console.error(detail);
    app.quit();
    return;
  }
  // 按常见启动失败类型给出可操作提示，而不是一律"启动失败"。
  const isPortBusy = /端口\s*\d+\s*已被/.test(raw) || raw.includes("已被其他程序占用");
  const isMissing = raw.includes("找不到服务端文件");
  const title = isPortBusy ? "端口被占用" : isMissing ? "缺少服务端文件" : "研墨 AI 启动失败";
  const hint = isPortBusy
    ? "请关闭占用端口的程序（通常是另一个研墨窗口或残留进程），或在任务管理器结束 YanMo.exe 后重试。"
    : isMissing
      ? "安装包可能不完整，请重新下载；源码运行请先执行 npm run build 与 npm run prepare:standalone。"
      : "请查看下方日志排查；如反复失败，可打开日志目录反馈。";
  void dialog
    .showMessageBox({
      type: "error",
      title,
      message: title,
      detail: `${hint}\n\n${detail}\n\n日志文件：\n${LOG_FILE}`,
      buttons: ["打开日志目录", "退出"],
      defaultId: 1,
      cancelId: 1
    })
    .then((result) => {
      if (result.response === 0) openLogs();
      app.quit();
    });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  stopServer();
  closeLog();
});
process.on("exit", stopServer);

// 记录未处理的 Promise 拒绝，避免异常被静默吞掉，便于排查桌面端问题。
process.on("unhandledRejection", (reason) => {
  const text = reason instanceof Error ? reason.stack || reason.message : String(reason);
  appendLog(`\n[unhandledRejection] ${text}\n`);
});
