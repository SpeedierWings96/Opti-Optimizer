const si = require('systeminformation');
const os = require('os');
const { exec } = require('child_process');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs').promises;

const store = new Store();

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
    }

    async getSystemStatus() {
        const [cpu, mem, disk, net, graphics] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats(),
            si.graphics()
        ]);

        return {
            cpu: {
                load: cpu.currentLoad,
                temp: await si.cpuTemperature(),
                cores: os.cpus()
            },
            memory: {
                total: mem.total,
                used: mem.used,
                free: mem.free,
                swapUsed: mem.swapused
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
    }

    // Windows Registry Tweaks
    async setRegistryValue(key, name, type, value) {
        const command = `reg add "${key}" /v "${name}" /t ${type} /d ${value} /f`;
        return new Promise((resolve, reject) => {
            exec(command, (error) => {
                if (error) reject(error);
                else resolve(true);
            });
        });
    }

    // Enhanced Memory Optimization
    async optimizeMemory() {
        if (process.platform === 'win32') {
            await Promise.all([
                // Clear system working set
                exec('powershell -Command "EmptyStandbyList"'),
                // Clear DNS cache
                exec('ipconfig /flushdns'),
                // Clear temp files
                exec('del /f /s /q %temp%\\*'),
                // Disable superfetch
                exec('net stop superfetch'),
                // Optimize paging file
                this.setRegistryValue(
                    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
                    'PagingFiles',
                    'REG_MULTI_SZ',
                    'C:\\pagefile.sys 16384 16384'
                )
            ]);
        }
        this.optimizations.memoryOptimized = true;
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
                // Optimize network adapter
                exec('netsh int ip reset'),
                exec('netsh winsock reset'),
                // Set DNS to Google's DNS
                exec('netsh interface ip set dns "Ethernet" static 8.8.8.8'),
                exec('netsh interface ip add dns "Ethernet" 8.8.4.4 index=2'),
                // Enable QoS
                this.setRegistryValue(
                    'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched',
                    'NonBestEffortLimit',
                    'REG_DWORD',
                    '0'
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
}

module.exports = new SystemOptimizer(); 