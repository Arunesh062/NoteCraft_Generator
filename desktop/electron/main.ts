import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { AudioCaptureManager } from './audio/AudioCaptureManager';

let mainWindow: BrowserWindow | null = null;
const audioManager = new AudioCaptureManager();

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'NoteCraft AI Desktop',
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry load after 1s if dev server is warming up
      setTimeout(() => {
        mainWindow?.loadURL(devUrl);
      }, 1000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler((_request: any, callback: any) => {
    callback({
      video: _request?.videoRequested ? (_request.frame || _request.videoRequested) : undefined,
      audio: 'loopback',
    });
  });

  audioManager.registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Secure, minimal Electron IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-system-info', () => ({
  arch: process.arch,
  platform: process.platform,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
}));

