'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { StateStore, validateState, atomicWrite } = require('./store.cjs');
const ROOT = path.resolve(__dirname, '..');
const HOME = pathToFileURL(path.join(ROOT, 'index.html')).href;
app.setName('界络祈愿');
app.setAppUserModelId('cn.muhuo.jieluo.wish');
// This stable path is independent of version, installation directory and portable extraction.
const dataDirectory = process.env.WISH_TEST_USER_DATA || path.join(app.getPath('appData'), '界络祈愿');
if (!path.isAbsolute(dataDirectory)) throw new Error('用户数据目录必须为绝对路径。');
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', dataDirectory);
const store = new StateStore(dataDirectory);
let mainWindow;
const ownsLock = app.requestSingleInstanceLock();
if (!ownsLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(() => {
    // The application is fully offline; prevent unexpected remote requests or permissions.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    const trusted = event => mainWindow && event.sender === mainWindow.webContents && event.senderFrame?.url.split('#')[0] === HOME;
    function handle(channel, fn) {
      ipcMain.on(channel, (event, value) => {
        try {
          if (!trusted(event)) throw new Error('不允许访问桌面存档。');
          event.returnValue = { ok: true, value: fn(value) };
        } catch (error) { event.returnValue = { ok: false, error: error.message }; }
      });
    }
    handle('wish:load', () => store.read());
    handle('wish:save', raw => { store.save(raw); return true; });
    mainWindow = new BrowserWindow({
      title: '界络祈愿', width: 1440, height: 1000, minWidth: 860, minHeight: 680,
      backgroundColor: '#101522', show: false,
      icon: path.join(ROOT, 'assets', 'favicon.svg'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged }
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== HOME) event.preventDefault(); });
    mainWindow.webContents.on('page-title-updated', event => event.preventDefault());
    mainWindow.webContents.on('did-finish-load', () => mainWindow?.setTitle('界络祈愿'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '界络祈愿', submenu: [{ label: '退出', role: 'quit' }] },
      { label: '数据', submenu: [
        { label: '导出备份…', click: exportBackup },
        { label: '导入备份 / 网页版存档…', click: importBackup },
        { type: 'separator' },
        { label: '打开数据文件夹', click: () => shell.openPath(dataDirectory) }
      ] },
      { label: '查看', submenu: [{ label: '重新加载', role: 'reload' }, { label: '全屏', role: 'togglefullscreen' }, { label: '放大', role: 'zoomin' }, { label: '缩小', role: 'zoomout' }, { label: '实际大小', role: 'resetzoom' }] },
      { label: '帮助', submenu: [{ label: '关于界络祈愿', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: '界络祈愿', message: '界络祈愿 ' + app.getVersion(), detail: '每台电脑独立保存数据，可离线使用。\n存档目录：' + dataDirectory }) }] }
    ]));
    mainWindow.loadFile(path.join(ROOT, 'index.html')).catch(error => { dialog.showErrorBox('界络祈愿启动失败', error.message); app.quit(); });
  }).catch(error => { dialog.showErrorBox('界络祈愿启动失败', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());

async function exportBackup() {
  try {
    const raw = store.read();
    if (raw === null) { await dialog.showMessageBox(mainWindow, { message: '尚无存档，请先保存学生信息。' }); return; }
    const result = await dialog.showSaveDialog(mainWindow, { title: '导出界络祈愿备份', defaultPath: '界络祈愿备份-' + new Date().toISOString().slice(0, 10) + '.json', filters: [{ name: '界络祈愿存档', extensions: ['json'] }] });
    if (!result.canceled && result.filePath) atomicWrite(result.filePath, raw);
  } catch (error) { dialog.showErrorBox('备份未完成', error.message); }
}
async function importBackup() {
  try {
    const result = await dialog.showOpenDialog(mainWindow, { title: '导入界络祈愿存档', properties: ['openFile'], filters: [{ name: '界络祈愿存档', extensions: ['json'] }] });
    if (result.canceled) return;
    const filename = result.filePaths[0];
    if (fs.statSync(filename).size > 25 * 1024 * 1024) throw new Error('存档超过 25 MB。');
    const raw = fs.readFileSync(filename, 'utf8'); validateState(raw);
    const confirm = await dialog.showMessageBox(mainWindow, { type: 'question', title: '导入备份', message: '用选定的备份替换本机全部档案？', detail: '当前存档会在数据目录中保留为 before-import 备份。', buttons: ['取消', '导入'], defaultId: 0, cancelId: 0 });
    if (confirm.response === 1) { store.restore(raw); mainWindow.reload(); }
  } catch (error) { dialog.showErrorBox('导入未完成', error.message); }
}
