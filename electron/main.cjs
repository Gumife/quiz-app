const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');
const os = require('os');
const http = require('http');

let mainWindow;
let viteProcess;

Menu.setApplicationMenu(null);

function waitForDevServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      http.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Vite dev server 启动超时'));
        } else {
          setTimeout(check, 500);
        }
      });
    }
    check();
  });
}

function startViteDevServer() {
  const projectRoot = path.join(__dirname, '..');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  viteProcess = spawn(npx, ['vite'], {
    cwd: projectRoot,
    stdio: 'ignore',
    windowsHide: true,
  });
  viteProcess.on('error', (err) => {
    console.error('Vite 启动失败:', err);
  });
  return waitForDevServer('http://localhost:5173');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    title: 'SelfQuiz',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    startViteDevServer()
      .then(() => {
        mainWindow.loadURL('http://localhost:5173');
      })
      .catch((err) => {
        dialog.showErrorBox('错误', `开发服务器启动失败: ${err.message}`);
        app.quit();
      });
  } else {
    const htmlPath = path.join(__dirname, '../dist/index.html');
    if (!fs.existsSync(htmlPath)) {
      dialog.showErrorBox('错误', `无法找到页面文件: ${htmlPath}`);
      app.quit();
      return;
    }
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
    dialog.showErrorBox('加载失败', `页面加载失败: ${errorDescription}`);
    mainWindow.show();
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('渲染进程崩溃:', details);
    dialog.showErrorBox('错误', '渲染进程意外退出，请重新启动应用');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('showOpenDialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('readFile', async (event, filePath) => {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('无效的文件路径');
  }
  const resolved = path.resolve(filePath);
  const homeDir = os.homedir();
  if (!resolved.startsWith(homeDir)) {
    throw new Error('不允许访问用户目录以外的文件');
  }
  const ALLOWED_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.pdf', '.xlsx', '.xls'];
  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`不支持的文件类型: ${ext || '(无扩展名)'}`);
  }
  return new Promise((resolve, reject) => {
    fs.readFile(resolved, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
});

function getConverterPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'python-converter.exe');
  }
  return path.join(__dirname, 'python-converter.exe');
}

ipcMain.handle('convertFile', async (event, fileBuffer, fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const supported = ['.docx', '.pdf', '.xlsx', '.xls'];
  if (!supported.includes(ext)) {
    throw new Error(`不支持的格式: ${ext}，请使用 Word/PDF/Excel 文件`);
  }

  const tmpPath = path.join(os.tmpdir(), `quiz_${Date.now()}${ext}`);
  try {
    fs.writeFileSync(tmpPath, Buffer.from(fileBuffer));

    const converter = getConverterPath();
    if (process.env.NODE_ENV === 'development') {
      console.log('[convertFile] converter:', converter);
      console.log('[convertFile] tmpFile:', tmpPath);
    }

    const result = execFileSync(converter, [tmpPath], {
      timeout: 30000,
      windowsHide: true,
      encoding: 'utf-8',
    });

    const parsed = JSON.parse(result.trim());
    if (parsed.error) throw new Error(parsed.error);
    return parsed.text || '';
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (viteProcess) {
    viteProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (viteProcess) {
    viteProcess.kill();
    viteProcess = null;
  }
});
