const si = require('systeminformation');
const os = require('os');
const { exec } = require('child_process');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const execAsync = util.promisify(exec);

const store = new Store();

// Add this cache system
const cache = {
    lastUpdate: 0,
    systemStatus: null,
    updateInterval: 1000, // 1 second cache
};

class SystemOptimizer {
    constructor() {
        this.optimizations = {
            running: false,
            memoryOptimized: false,
            networkOptimized: false,
            diskOptimized: false,
            gamingMode: false,
            darkMode: false,
            privacyMode: false,
            performanceMode: false
        };
        
        // Initialize monitoring buffers
        this.cpuHistory = new Array(60).fill(0);
        this.memoryHistory = new Array(60).fill(0);
        this.lastError = null;
    }

    // Improved system status monitoring
    async getSystemStatus() {
        try {
            // Return cached data if it's fresh
            if (Date.now() - cache.lastUpdate < cache.updateInterval && cache.systemStatus) {
                return cache.systemStatus;
            }

            const [cpu, mem, disk, net, graphics] = await Promise.all([
                si.currentLoad().catch(() => ({ currentLoad: 0 })),
                si.mem().catch(() => ({ total: 0, used: 0, free: 0, swapused: 0 })),
                si.fsSize().catch(() => ([{ use: 0, size: 0, used: 0 }])),
                si.networkStats().catch(() => ([{ tx_sec: 0, rx_sec: 0 }])),
                si.graphics().catch(() => ({ controllers: [{}] }))
            ]);

            // Update history buffers
            this.cpuHistory.push(cpu.currentLoad);
            this.cpuHistory.shift();
            this.memoryHistory.push((mem.used / mem.total) * 100);
            this.memoryHistory.shift();

            const status = {
                cpu: {
                    load: cpu.currentLoad,
                    temp: await si.cpuTemperature().catch(() => ({ main: 0 })),
                    cores: os.cpus(),
                    history: this.cpuHistory
                },
                memory: {
                    total: mem.total,
                    used: mem.used,
                    free: mem.free,
                    swapUsed: mem.swapused,
                    history: this.memoryHistory
                },
                disk: {
                    usage: disk[0].use,
                    free: disk[0].size - disk[0].used
                },
                network: {
                    upload: net[0].tx_sec,
                    download: net[0].rx_sec
                },
                gpu: graphics.controllers[0]
            };

            // Update cache
            cache.systemStatus = status;
            cache.lastUpdate = Date.now();

            return status;
        } catch (error) {
            console.error('Error getting system status:', error);
            this.lastError = error;
            return cache.systemStatus || {
                cpu: { load: 0, temp: { main: 0 }, cores: [], history: this.cpuHistory },
                memory: { total: 0, used: 0, free: 0, swapUsed: 0, history: this.memoryHistory },
                disk: { usage: 0, free: 0 },
                network: { upload: 0, download: 0 },
                gpu: {}
            };
        }
    }

    // Improved registry value setter with error handling
    async setRegistryValue(key, name, type, value) {
        try {
            const command = `reg add "${key}" /v "${name}" /t ${type} /d ${value} /f`;
            await execAsync(command);
            return true;
        } catch (error) {
            console.error(`Failed to set registry value ${key}\\${name}:`, error);
            throw new Error(`Registry operation failed: ${error.message}`);
        }
    }

    // Add error handling to exec commands
    async execCommand(command) {
        try {
            await execAsync(command);
            return true;
        } catch (error) {
            console.error(`Failed to execute command: ${command}`, error);
            throw new Error(`Command execution failed: ${error.message}`);
        }
    }

    // Enhanced Memory Optimization with better error handling
    async optimizeMemory() {
        if (process.platform === 'win32') {
            try {
                const commands = [
                    'powershell -Command "Get-Process | Where-Object {$_.Name -notlike \'*system*\'} | Sort-Object -Property WS -Descending | Select-Object -First 5 | Stop-Process -Force"',
                    'ipconfig /flushdns',
                    'del /f /s /q %temp%\\*',
                    'net stop superfetch',
                    'powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"'
                ];

                for (const command of commands) {
                    await this.execCommand(command).catch(console.error);
                }

                await this.setRegistryValue(
                    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
                    'ClearPageFileAtShutdown',
                    'REG_DWORD',
                    '1'
                );

                this.optimizations.memoryOptimized = true;
                return true;
            } catch (error) {
                console.error('Memory optimization failed:', error);
                throw error;
            }
        }
        return false;
    }

    // Windows Registry Tweaks
    async togglePowerPlan(enable = true) {
        if (process.platform === 'win32') {
            if (enable) {
                await exec('powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c');
            } else {
                await exec('powercfg -setactive scheme_balanced');
            }
        }
        return true;
    }

    // Windows Game Mode
    async toggleWindowsGameMode(enable = true) {
        if (process.platform === 'win32') {
            await this.setRegistryValue(
                'HKCU\\Software\\Microsoft\\GameBar',
                'AllowAutoGameMode',
                'REG_DWORD',
                enable ? '1' : '0'
            );
            await this.setRegistryValue(
                'HKCU\\Software\\Microsoft\\GameBar',
                'AutoGameModeEnabled',
                'REG_DWORD',
                enable ? '1' : '0'
            );
        }
        return true;
    }

    // GPU Priority
    async toggleGPUPriority(enable = true) {
        if (process.platform === 'win32') {
            await this.setRegistryValue(
                'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
                'GPU Priority',
                'REG_DWORD',
                enable ? '8' : '4'
            );
            await this.setRegistryValue(
                'HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
                'HwSchMode',
                'REG_DWORD',
                enable ? '2' : '1'
            );
        }
        return true;
    }

    // Telemetry Control
    async toggleTelemetry(enable = true) {
        if (process.platform === 'win32') {
            const services = ['DiagTrack', 'dmwappushservice'];
            for (const service of services) {
                await exec(`sc ${enable ? 'stop' : 'start'} ${service}`);
                await exec(`sc config ${service} start= ${enable ? 'disabled' : 'auto'}`);
            }
            await this.setRegistryValue(
                'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection',
                'AllowTelemetry',
                'REG_DWORD',
                enable ? '0' : '1'
            );
        }
        return true;
    }

    // Location Services
    async toggleLocationServices(enable = true) {
        if (process.platform === 'win32') {
            await this.setRegistryValue(
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location',
                'Value',
                'REG_SZ',
                enable ? 'Deny' : 'Allow'
            );
            await exec(`sc ${enable ? 'stop' : 'start'} lfsvc`);
        }
        return true;
    }

    // Activity History
    async toggleActivityHistory(enable = true) {
        if (process.platform === 'win32') {
            await this.setRegistryValue(
                'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System',
                'EnableActivityFeed',
                'REG_DWORD',
                enable ? '0' : '1'
            );
            await this.setRegistryValue(
                'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System',
                'PublishUserActivities',
                'REG_DWORD',
                enable ? '0' : '1'
            );
        }
        return true;
    }

    // Auto Start Control
    async toggleAutoStart(enable = true) {
        if (process.platform === 'win32') {
            const regPath = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run';
            if (enable) {
                await this.setRegistryValue(
                    regPath,
                    'OptiOptimizer',
                    'REG_SZ',
                    `"${process.execPath}"`
                );
            } else {
                await exec(`reg delete "${regPath}" /v "OptiOptimizer" /f`);
            }
        }
        return true;
    }

    // Notifications Control
    async toggleNotifications(enable = true) {
        if (process.platform === 'win32') {
            await this.setRegistryValue(
                'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications',
                'ToastEnabled',
                'REG_DWORD',
                enable ? '1' : '0'
            );
        }
        return true;
    }

    // Enhanced Network Optimization
    async optimizeNetwork() {
        if (process.platform === 'win32') {
            await Promise.all([
                // Optimize TCP settings
                exec('netsh int tcp set global autotuninglevel=normal'),
                exec('netsh int tcp set global chimney=enabled'),
                exec('netsh int tcp set global dca=enabled'),
                exec('netsh int tcp set global netdma=enabled'),
                exec('netsh int tcp set global ecncapability=enabled'),
                // Optimize network adapter
                exec('netsh int ip reset'),
                exec('netsh winsock reset'),
                // Set DNS to Cloudflare's DNS
                exec('netsh interface ip set dns "Ethernet" static 1.1.1.1'),
                exec('netsh interface ip add dns "Ethernet" 1.0.0.1 index=2'),
                // Enable QoS
                this.setRegistryValue(
                    'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched',
                    'NonBestEffortLimit',
                    'REG_DWORD',
                    '0'
                ),
                // Optimize network throttling
                this.setRegistryValue(
                    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
                    'NetworkThrottlingIndex',
                    'REG_DWORD',
                    'ffffffff'
                )
            ]);
        }
        this.optimizations.networkOptimized = true;
        return true;
    }

    // Enhanced Gaming Mode
    async toggleGamingMode(enable = true) {
        if (process.platform === 'win32') {
            if (enable) {
                await Promise.all([
                    // Set high performance power plan
                    exec('powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'),
                    // Optimize for gaming
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
                        'SystemResponsiveness',
                        'REG_DWORD',
                        '0'
                    ),
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
                        'GPU Priority',
                        'REG_DWORD',
                        '8'
                    ),
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
                        'Priority',
                        'REG_DWORD',
                        '6'
                    ),
                    // Disable full-screen optimizations
                    this.setRegistryValue(
                        'HKCU\\System\\GameConfigStore',
                        'GameDVR_Enabled',
                        'REG_DWORD',
                        '0'
                    ),
                    // Disable Game Bar
                    this.setRegistryValue(
                        'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR',
                        'AppCaptureEnabled',
                        'REG_DWORD',
                        '0'
                    ),
                    // Optimize mouse settings
                    this.setRegistryValue(
                        'HKCU\\Control Panel\\Mouse',
                        'MouseSensitivity',
                        'REG_SZ',
                        '10'
                    ),
                    // Disable power throttling
                    this.setRegistryValue(
                        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling',
                        'PowerThrottlingOff',
                        'REG_DWORD',
                        '1'
                    )
                ]);
            } else {
                // Restore default settings
                await Promise.all([
                    exec('powercfg -setactive scheme_balanced'),
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
                        'SystemResponsiveness',
                        'REG_DWORD',
                        '20'
                    )
                ]);
            }
        }
        this.optimizations.gamingMode = enable;
        return true;
    }

    // System Theme Control
    async toggleDarkMode(enable = true) {
        if (process.platform === 'win32') {
            await Promise.all([
                // System theme
                this.setRegistryValue(
                    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
                    'SystemUsesLightTheme',
                    'REG_DWORD',
                    enable ? '0' : '1'
                ),
                // App theme
                this.setRegistryValue(
                    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
                    'AppsUseLightTheme',
                    'REG_DWORD',
                    enable ? '0' : '1'
                )
            ]);
        }
        this.optimizations.darkMode = enable;
        return true;
    }

    // Enhanced Privacy Mode
    async togglePrivacyMode(enable = true) {
        if (process.platform === 'win32') {
            if (enable) {
                await Promise.all([
                    // Disable telemetry
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection',
                        'AllowTelemetry',
                        'REG_DWORD',
                        '0'
                    ),
                    // Disable advertising ID
                    this.setRegistryValue(
                        'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo',
                        'Enabled',
                        'REG_DWORD',
                        '0'
                    ),
                    // Disable app diagnostics
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Diagnostics\\DiagTrack',
                        'DiagTrackAuthorization',
                        'REG_DWORD',
                        '0'
                    ),
                    // Disable location tracking
                    this.setRegistryValue(
                        'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location',
                        'Value',
                        'REG_SZ',
                        'Deny'
                    ),
                    // Disable timeline
                    this.setRegistryValue(
                        'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System',
                        'EnableActivityFeed',
                        'REG_DWORD',
                        '0'
                    )
                ]);
            }
        }
        this.optimizations.privacyMode = enable;
        return true;
    }

    // Ultimate Performance Mode
    async togglePerformanceMode(enable = true) {
        if (process.platform === 'win32') {
            if (enable) {
                await Promise.all([
                    // Create and set ultimate performance power plan
                    exec('powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61'),
                    // Disable system restore
                    exec('powershell -Command "Disable-ComputerRestore -Drive "C:""'),
                    // Disable hibernate
                    exec('powercfg -h off'),
                    // Disable windows search
                    exec('net stop "Windows Search"'),
                    // Optimize visual effects
                    this.setRegistryValue(
                        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
                        'VisualFXSetting',
                        'REG_DWORD',
                        '2'
                    )
                ]);
            } else {
                await Promise.all([
                    exec('powercfg -setactive scheme_balanced'),
                    exec('powershell -Command "Enable-ComputerRestore -Drive "C:""'),
                    exec('powercfg -h on'),
                    exec('net start "Windows Search"')
                ]);
            }
        }
        this.optimizations.performanceMode = enable;
        return true;
    }

    // Get current optimization status
    getOptimizationStatus() {
        return {
            ...this.optimizations,
            lastRun: store.get('lastOptimization')
        };
    }

    // Save settings
    async saveSettings(settings) {
        store.set('settings', settings);
        return true;
    }

    // Load settings
    getSettings() {
        return store.get('settings', {
            autoStart: false,
            darkMode: true,
            gamingMode: false,
            privacyMode: true,
            performanceMode: false
        });
    }

    // Add a method to get the last error
    getLastError() {
        return this.lastError;
    }

    // Add a method to clear optimization flags
    resetOptimizations() {
        this.optimizations = {
            running: false,
            memoryOptimized: false,
            networkOptimized: false,
            diskOptimized: false,
            gamingMode: false,
            darkMode: false,
            privacyMode: false,
            performanceMode: false
        };
    }
}

module.exports = new SystemOptimizer(); 