const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const Store = require('electron-store');

class SystemTweaks {
    constructor() {
        this.store = new Store();
        this.backups = this.store.get('registry_backups', {});
    }

    async applyGamingTweaks() {
        try {
            // Backup current settings
            await this.backupSettings('gaming');

            const tweaks = [
                // CPU Priority
                {
                    path: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
                    settings: {
                        'GPU Priority': 8,
                        'Priority': 6,
                        'Scheduling Category': 'High',
                        'SFIO Priority': 'High'
                    }
                },
                // Network Optimization
                {
                    path: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
                    settings: {
                        'NetworkThrottlingIndex': 0xffffffff,
                        'SystemResponsiveness': 0
                    }
                },
                // Mouse and Keyboard
                {
                    path: 'HKCU\\Control Panel\\Mouse',
                    settings: {
                        'MouseSensitivity': '10',
                        'MouseSpeed': '0',
                        'MouseThreshold1': '0',
                        'MouseThreshold2': '0'
                    }
                }
            ];

            // Apply each tweak
            for (const tweak of tweaks) {
                for (const [key, value] of Object.entries(tweak.settings)) {
                    await this.setRegistryValue(tweak.path, key, this.getValueType(value), value);
                }
            }

            // Additional gaming optimizations
            await Promise.all([
                // Disable fullscreen optimizations
                this.setRegistryValue(
                    'HKCU\\System\\GameConfigStore',
                    'GameDVR_FSEBehavior',
                    'REG_DWORD',
                    0
                ),
                // Disable Game DVR
                this.setRegistryValue(
                    'HKCU\\System\\GameConfigStore',
                    'GameDVR_Enabled',
                    'REG_DWORD',
                    0
                ),
                // Set GPU high performance
                this.setRegistryValue(
                    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
                    'GraphicsPreference',
                    'REG_DWORD',
                    2
                )
            ]);

            // Power settings
            await this.optimizePowerPlan();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async applyNetworkTweaks() {
        try {
            await this.backupSettings('network');

            // Network adapter optimizations
            const commands = [
                'netsh int tcp set global autotuninglevel=normal',
                'netsh int tcp set global chimney=enabled',
                'netsh int tcp set global dca=enabled',
                'netsh int tcp set global netdma=enabled',
                'netsh int tcp set global ecncapability=enabled',
                'netsh int tcp set global timestamps=disabled',
                'netsh int tcp set global rss=enabled',
                'netsh int tcp set global nonsackrttresiliency=disabled',
                'netsh int tcp set global initialRto=2000',
                'netsh int tcp set supplemental template=custom icw=10',
                'netsh interface tcp set heuristics disabled',
                'netsh interface tcp set global congestionprovider=ctcp'
            ];

            for (const cmd of commands) {
                await execAsync(cmd);
            }

            // Registry optimizations
            const networkTweaks = {
                'HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters': {
                    'TcpMaxDataRetransmissions': 5,
                    'SackOpts': 1,
                    'TcpTimedWaitDelay': 30,
                    'DefaultTTL': 64
                },
                'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile': {
                    'NetworkThrottlingIndex': 0xffffffff,
                    'SystemResponsiveness': 0
                }
            };

            for (const [path, settings] of Object.entries(networkTweaks)) {
                for (const [key, value] of Object.entries(settings)) {
                    await this.setRegistryValue(path, key, this.getValueType(value), value);
                }
            }

            // Set DNS to Cloudflare
            await execAsync('netsh interface ip set dns "Ethernet" static 1.1.1.1');
            await execAsync('netsh interface ip add dns "Ethernet" 1.0.0.1 index=2');

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async applyPrivacyTweaks() {
        try {
            await this.backupSettings('privacy');

            const privacyTweaks = {
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection': {
                    'AllowTelemetry': 0
                },
                'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection': {
                    'AllowTelemetry': 0
                },
                'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy': {
                    'TailoredExperiencesWithDiagnosticDataEnabled': 0
                },
                'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent': {
                    'DisableWindowsConsumerFeatures': 1
                },
                'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced': {
                    'Start_TrackProgs': 0
                },
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo': {
                    'Enabled': 0
                }
            };

            for (const [path, settings] of Object.entries(privacyTweaks)) {
                for (const [key, value] of Object.entries(settings)) {
                    await this.setRegistryValue(path, key, this.getValueType(value), value);
                }
            }

            // Disable services
            const services = [
                'DiagTrack',
                'dmwappushservice',
                'RetailDemo',
                'diagnosticshub.standardcollector.service'
            ];

            for (const service of services) {
                await execAsync(`sc stop "${service}"`);
                await execAsync(`sc config "${service}" start= disabled`);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async optimizePowerPlan() {
        try {
            // Create ultimate performance plan
            await execAsync('powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61');
            
            // Set active scheme
            const { stdout } = await execAsync('powercfg /list');
            const match = stdout.match(/Power Scheme GUID: ([a-f0-9-]+)\s+\(Ultimate Performance\)/i);
            if (match) {
                await execAsync(`powercfg /setactive ${match[1]}`);
            }

            // Disable power throttling
            await this.setRegistryValue(
                'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling',
                'PowerThrottlingOff',
                'REG_DWORD',
                1
            );

            return true;
        } catch (error) {
            console.error('Power plan optimization error:', error);
            return false;
        }
    }

    async restoreSettings(category) {
        try {
            const backup = this.backups[category];
            if (!backup) {
                throw new Error(`No backup found for category: ${category}`);
            }

            for (const { path, name, type, value } of backup) {
                await this.setRegistryValue(path, name, type, value);
            }

            delete this.backups[category];
            this.store.set('registry_backups', this.backups);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Helper methods
    async backupSettings(category) {
        const backup = [];
        // Add backup logic here based on category
        this.backups[category] = backup;
        this.store.set('registry_backups', this.backups);
    }

    async setRegistryValue(key, name, type, value) {
        const command = `reg add "${key}" /v "${name}" /t ${type} /d ${value} /f`;
        return execAsync(command);
    }

    getValueType(value) {
        if (typeof value === 'number') {
            return 'REG_DWORD';
        }
        return 'REG_SZ';
    }
}

module.exports = new SystemTweaks(); 