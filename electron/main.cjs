const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

// 固定端口可以让 localStorage 的 origin 保持稳定，报告和设置才不会每次启动都丢失。
const DEFAULT_PORT = 38217;
const PORT = Number(process.env.YANMO_PORT) || DEFAULT_PORT;
const CAPTURE_PATH = process.env.YANMO_CAPTURE_PATH || "";

let mainWindow = null;
let serverProcess = null;
let serverLogs = "";
let logStream = null;

app.setName("YanMo");
app.setPath("userData", path.join(app.getPath("appData"), "YanMo"));
const LOG_DIR = path.join(app.getPath("userData"), "logs");
const LOG_FILE = path.join(LOG_DIR, "server.log");

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
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

  const url = `http://127.0.0.1:${PORT}`;
  await waitForServer(url);
  return url;
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {}
  }
  serverProcess = null;
}

async function createWindow(url) {
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#f8f9fa",
    autoHideMenuBar: true,
    title: "研墨 AI",
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (!CAPTURE_PATH && mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(`http://127.0.0.1:${PORT}`)) {
      return { action: "allow" };
    }
    void shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(`http://127.0.0.1:${PORT}`)) {
      event.preventDefault();
      void shell.openExternal(target);
    }
  });

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
    }, 1500);
  }
}

async function bootstrap() {
  prepareLog();
  const url = await startServer();
  await createWindow(url);
}

function handleFatal(error) {
  console.error(error);
  const detail = serverLogs ? `${error.message}\n\n${serverLogs}` : error.message;
  appendLog(`\n[fatal] ${detail}\n`);
  if (CAPTURE_PATH) {
    console.error(detail);
    app.quit();
    return;
  }
  dialog.showErrorBox(
    "研墨 AI 启动失败",
    `${detail}\n\n日志文件：\n${LOG_FILE}`
  );
  app.quit();
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
  closeLog();
});
process.on("exit", stopServer);
