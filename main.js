const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Hide the console window in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  process.stdout.write = () => {};
  process.stderr.write = () => {};
}

// Initialize settings store
const store = new Store();

// Global window reference
let mainWindow = null;

function createWindow() {
  // Load window state
  const windowState = store.get('windowState', {
    width: 1000,
    height: 700,
    x: undefined,
    y: undefined
  });

  mainWindow = new BrowserWindow({
    ...windowState,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js')
    },
    backgroundColor: '#0a0a0f',
    transparent: true,
    roundedCorners: true,
    show: false,
    // Performance optimizations
    backgroundThrottling: false,
    autoHideMenuBar: true
  });

  // Hide the menu bar completely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  // Load the index.html
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  // Save window state on close
  ['resize', 'move'].forEach(event => {
    mainWindow.on(event, () => {
      if (!mainWindow.isMaximized()) {
        const bounds = mainWindow.getBounds();
        store.set('windowState', bounds);
      }
    });
  });

  // Smooth window appearance with fade-in
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('app-ready');
    }, 400);
  });

  // Optimize memory usage
  mainWindow.webContents.setBackgroundThrottling(false);
}

// App initialization
app.whenReady().then(() => {
  createWindow();

  // Handle macOS dock click
  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });
});

// Window management
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers for window controls
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

// Error handling
process.on('uncaughtException', (error) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Uncaught Exception:', error);
  }
});

// Performance monitoring
if (process.env.NODE_ENV !== 'production') {
  app.on('ready', () => {
    const startupTime = process.hrtime();
    app.on('browser-window-created', () => {
      const [seconds, nanoseconds] = process.hrtime(startupTime);
      console.log(`Window created in ${seconds}s ${nanoseconds / 1000000}ms`);
    });
  });
} 