const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class SystemCleaner {
    constructor() {
        this.cleaningPaths = {
            temp: [
                '%temp%',
                '%systemroot%\\temp',
                '%localappdata%\\Temp',
                '%appdata%\\Temp'
            ],
            windows: [
                '%systemroot%\\Logs',
                '%systemroot%\\Debug',
                '%systemroot%\\Prefetch',
                '%systemroot%\\SoftwareDistribution\\Download'
            ],
            browsers: {
                chrome: '%localappdata%\\Google\\Chrome\\User Data\\Default\\Cache',
                firefox: '%appdata%\\Mozilla\\Firefox\\Profiles\\*.default\\cache2',
                edge: '%localappdata%\\Microsoft\\Edge\\User Data\\Default\\Cache'
            },
            apps: [
                '%localappdata%\\CrashDumps',
                '%localappdata%\\Microsoft\\Windows\\Explorer\\ThumbCacheToDelete',
                '%localappdata%\\Microsoft\\Windows\\INetCache'
            ]
        };
    }

    async cleanSystem() {
        const results = {
            spaceFreed: 0,
            errors: [],
            cleanedPaths: []
        };

        try {
            // Stop unnecessary services
            await this.stopServices([
                'SysMain', // Superfetch
                'DiagTrack', // Telemetry
                'wuauserv' // Windows Update
            ]);

            // Clean Windows components
            await this.cleanWindowsComponents();

            // Clean each path category
            for (const [category, paths] of Object.entries(this.cleaningPaths)) {
                if (typeof paths === 'object' && !Array.isArray(paths)) {
                    // Handle nested objects (like browsers)
                    for (const [app, path] of Object.entries(paths)) {
                        const cleaned = await this.cleanPath(path);
                        results.spaceFreed += cleaned.spaceFreed;
                        results.cleanedPaths.push(...cleaned.cleanedPaths);
                        if (cleaned.error) results.errors.push(cleaned.error);
                    }
                } else {
                    // Handle arrays of paths
                    for (const path of paths) {
                        const cleaned = await this.cleanPath(path);
                        results.spaceFreed += cleaned.spaceFreed;
                        results.cleanedPaths.push(...cleaned.cleanedPaths);
                        if (cleaned.error) results.errors.push(cleaned.error);
                    }
                }
            }

            // Additional cleaning tasks
            await Promise.all([
                this.cleanRegistry(),
                this.optimizeDrives(),
                this.clearEventLogs(),
                this.cleanWindowsSearch(),
                this.cleanSystemRestorePoints()
            ]);

            // Restart services
            await this.startServices([
                'SysMain',
                'wuauserv'
            ]);

            return {
                success: true,
                ...results,
                spaceFreedFormatted: this.formatBytes(results.spaceFreed)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                ...results,
                spaceFreedFormatted: this.formatBytes(results.spaceFreed)
            };
        }
    }

    async cleanPath(dirPath) {
        const result = {
            spaceFreed: 0,
            cleanedPaths: [],
            error: null
        };

        try {
            // Expand environment variables
            const expandedPath = await this.expandEnvironmentPath(dirPath);
            
            // Calculate space before cleaning
            const spaceBefore = await this.calculateDirectorySize(expandedPath);
            
            // Clean the directory
            await execAsync(`del /f /s /q "${expandedPath}\\*.*"`);
            
            // Calculate space after cleaning
            const spaceAfter = await this.calculateDirectorySize(expandedPath);
            
            result.spaceFreed = spaceBefore - spaceAfter;
            result.cleanedPaths.push(expandedPath);
        } catch (error) {
            result.error = `Failed to clean ${dirPath}: ${error.message}`;
        }

        return result;
    }

    async cleanRegistry() {
        const regCommands = [
            'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RunMRU" /va /f',
            'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\TypedPaths" /va /f',
            'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RecentDocs" /va /f'
        ];

        for (const cmd of regCommands) {
            try {
                await execAsync(cmd);
            } catch (error) {
                console.error(`Registry cleaning error: ${error.message}`);
            }
        }
    }

    async optimizeDrives() {
        try {
            // Get all fixed drives
            const drives = await this.getFixedDrives();
            
            for (const drive of drives) {
                // Optimize based on drive type (SSD vs HDD)
                const isSSD = await this.isSSDDrive(drive);
                if (isSSD) {
                    await execAsync(`fsutil behavior set DisableLastAccess 1`);
                    await execAsync(`fsutil behavior set EncryptPagingFile 0`);
                } else {
                    await execAsync(`defrag ${drive} /O /U`);
                }
            }
        } catch (error) {
            console.error(`Drive optimization error: ${error.message}`);
        }
    }

    async cleanWindowsComponents() {
        const commands = [
            'dism.exe /online /Cleanup-Image /StartComponentCleanup',
            'dism.exe /online /Cleanup-Image /SPSuperseded',
            'dism.exe /online /Cleanup-Image /RestoreHealth'
        ];

        for (const cmd of commands) {
            try {
                await execAsync(cmd);
            } catch (error) {
                console.error(`Windows component cleaning error: ${error.message}`);
            }
        }
    }

    async clearEventLogs() {
        try {
            const logs = await execAsync('wevtutil.exe el');
            const logNames = logs.stdout.split('\n');
            
            for (const log of logNames) {
                const logName = log.trim();
                if (logName) {
                    await execAsync(`wevtutil.exe cl "${logName}"`);
                }
            }
        } catch (error) {
            console.error(`Event log clearing error: ${error.message}`);
        }
    }

    async cleanWindowsSearch() {
        try {
            await execAsync('net stop "Windows Search"');
            await execAsync('del /f /s /q "%ProgramData%\\Microsoft\\Search\\Data\\Applications\\Windows\\*.*"');
            await execAsync('net start "Windows Search"');
        } catch (error) {
            console.error(`Windows Search cleaning error: ${error.message}`);
        }
    }

    async cleanSystemRestorePoints() {
        try {
            // Keep only the most recent restore point
            await execAsync('vssadmin delete shadows /for=C: /all /quiet');
            await execAsync('vssadmin resize shadowstorage /for=C: /on=C: /maxsize=2GB');
        } catch (error) {
            console.error(`System restore point cleaning error: ${error.message}`);
        }
    }

    // Helper methods
    async stopServices(services) {
        for (const service of services) {
            try {
                await execAsync(`net stop "${service}" /y`);
            } catch (error) {
                console.error(`Failed to stop ${service}: ${error.message}`);
            }
        }
    }

    async startServices(services) {
        for (const service of services) {
            try {
                await execAsync(`net start "${service}"`);
            } catch (error) {
                console.error(`Failed to start ${service}: ${error.message}`);
            }
        }
    }

    async expandEnvironmentPath(path) {
        let expandedPath = path;
        const envVars = path.match(/%[^%]+%/g) || [];
        
        for (const envVar of envVars) {
            const varName = envVar.replace(/%/g, '');
            const varValue = process.env[varName];
            if (varValue) {
                expandedPath = expandedPath.replace(envVar, varValue);
            }
        }
        
        return expandedPath;
    }

    async calculateDirectorySize(dirPath) {
        try {
            const { stdout } = await execAsync(`dir /s "${dirPath}" | findstr "File(s)"`);
            const match = stdout.match(/(\d+) bytes/);
            return match ? parseInt(match[1]) : 0;
        } catch (error) {
            return 0;
        }
    }

    async getFixedDrives() {
        try {
            const { stdout } = await execAsync('wmic logicaldisk where drivetype=3 get caption');
            return stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line && line !== 'Caption');
        } catch (error) {
            return ['C:'];
        }
    }

    async isSSDDrive(drive) {
        try {
            const { stdout } = await execAsync(`wmic diskdrive where "DeviceID like '%${drive.replace(':', '')}%'" get MediaType`);
            return stdout.toLowerCase().includes('ssd');
        } catch (error) {
            return false;
        }
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new SystemCleaner(); 