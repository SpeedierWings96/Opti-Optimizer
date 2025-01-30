const { contextBridge, ipcRenderer } = require('electron');
const optimizer = require('./optimizations');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    window: {
      minimize: () => ipcRenderer.invoke('window-minimize'),
      maximize: () => ipcRenderer.invoke('window-maximize'),
      close: () => ipcRenderer.invoke('window-close')
    },
    onAppReady: (callback) => {
      ipcRenderer.on('app-ready', callback);
    },
    optimizer: {
      getSystemStatus: () => optimizer.getSystemStatus(),
      runAllOptimizations: () => optimizer.runAllOptimizations(),
      optimizeMemory: () => optimizer.optimizeMemory(),
      optimizeNetwork: () => optimizer.optimizeNetwork(),
      optimizeDisk: () => optimizer.optimizeDisk(),
      optimizeGaming: () => optimizer.optimizeGaming(),
      optimizePrivacy: () => optimizer.optimizePrivacy(),
      getOptimizationStatus: () => optimizer.getOptimizationStatus()
    },
    getSystemInfo: async () => {
      const os = require('os');
      return {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus(),
        totalMem: os.totalmem(),
        freeMem: os.freemem()
      };
    }
  }
); 