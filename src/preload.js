const { contextBridge, ipcRenderer } = require('electron');
const optimizer = require('./optimizations');
const cleaner = require('./cleaners');
const tweaks = require('./tweaks');
const analytics = require('./analytics');

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
      // System Status
      getSystemStatus: () => optimizer.getSystemStatus(),
      getOptimizationStatus: () => optimizer.getOptimizationStatus(),
      
      // Memory Optimization
      optimizeMemory: () => optimizer.optimizeMemory(),
      
      // Network Optimization
      optimizeNetwork: () => optimizer.optimizeNetwork(),
      
      // Gaming Mode
      toggleGamingMode: (enable) => optimizer.toggleGamingMode(enable),
      
      // Performance Mode
      togglePerformanceMode: (enable) => optimizer.togglePerformanceMode(enable),
      
      // Privacy Mode
      togglePrivacyMode: (enable) => optimizer.togglePrivacyMode(enable),
      
      // Dark Mode
      toggleDarkMode: (enable) => optimizer.toggleDarkMode(enable),
      
      // Settings
      getSettings: () => optimizer.getSettings(),
      saveSettings: (settings) => optimizer.saveSettings(settings)
    },
    cleaner: {
      // System Cleaning
      cleanSystem: () => cleaner.cleanSystem(),
      cleanPath: (path) => cleaner.cleanPath(path),
      cleanRegistry: () => cleaner.cleanRegistry(),
      optimizeDrives: () => cleaner.optimizeDrives(),
      cleanWindowsComponents: () => cleaner.cleanWindowsComponents(),
      clearEventLogs: () => cleaner.clearEventLogs(),
      cleanWindowsSearch: () => cleaner.cleanWindowsSearch(),
      cleanSystemRestorePoints: () => cleaner.cleanSystemRestorePoints()
    },
    tweaks: {
      // Gaming Tweaks
      applyGamingTweaks: () => tweaks.applyGamingTweaks(),
      
      // Network Tweaks
      applyNetworkTweaks: () => tweaks.applyNetworkTweaks(),
      
      // Privacy Tweaks
      applyPrivacyTweaks: () => tweaks.applyPrivacyTweaks(),
      
      // Power Plan
      optimizePowerPlan: () => tweaks.optimizePowerPlan(),
      
      // Settings Management
      restoreSettings: (category) => tweaks.restoreSettings(category)
    },
    analytics: {
      // System Information
      getFullSystemInfo: () => analytics.getFullSystemInfo(),
      
      // Performance Monitoring
      getPerformanceMetrics: () => analytics.getPerformanceMetrics(),
      getPerformanceHistory: (duration) => analytics.getPerformanceHistory(duration),
      
      // System Health
      getSystemHealth: () => analytics.getSystemHealth()
    },
    // Additional Controls
    controls: {
      togglePowerPlan: (enable) => optimizer.togglePowerPlan(enable),
      toggleWindowsGameMode: (enable) => optimizer.toggleWindowsGameMode(enable),
      toggleGPUPriority: (enable) => optimizer.toggleGPUPriority(enable),
      toggleTelemetry: (enable) => optimizer.toggleTelemetry(enable),
      toggleLocationServices: (enable) => optimizer.toggleLocationServices(enable),
      toggleActivityHistory: (enable) => optimizer.toggleActivityHistory(enable),
      toggleAutoStart: (enable) => optimizer.toggleAutoStart(enable),
      toggleNotifications: (enable) => optimizer.toggleNotifications(enable)
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