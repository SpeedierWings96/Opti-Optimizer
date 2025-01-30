const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const Store = require('electron-store');
const fs = require('fs').promises;
const path = require('path');

class StartupManager {
    constructor() {
        this.store = new Store();
        this.startupLocations = {
            registry: [
                'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
                'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'
            ],
            folders: [
                '%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup',
                '%PROGRAMDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'
            ]
        };
        this.knownStartupItems = {
            'Steam': {
                impact: 'medium',
                recommended: false
            },
            'Discord': {
                impact: 'medium',
                recommended: false
            },
            'Spotify': {
                impact: 'medium',
                recommended: false
            },
            'Microsoft Teams': {
                impact: 'high',
                recommended: false
            },
            'Skype': {
                impact: 'high',
                recommended: false
            },
            'OneDrive': {
                impact: 'high',
                recommended: true
            },
            'Adobe Creative Cloud': {
                impact: 'high',
                recommended: false
            },
            'Epic Games Launcher': {
                impact: 'high',
                recommended: false
            },
            'Dropbox': {
                impact: 'medium',
                recommended: true
            }
        };
    }

    async getStartupItems() {
        const items = [];

        // Scan registry locations
        for (const regPath of this.startupLocations.registry) {
            try {
                const { stdout } = await execAsync(`reg query "${regPath}"`);
                const entries = stdout.split('\r\n')
                    .filter(line => line.trim())
                    .filter(line => !line.includes('(Default)'))
                    .map(line => {
                        const parts = line.trim().split('    ').filter(Boolean);
                        if (parts.length >= 3) {
                            return {
                                name: parts[0],
                                type: parts[1],
                                command: parts[2],
                                source: regPath,
                                enabled: true
                            };
                        }
                        return null;
                    })
                    .filter(Boolean);

                items.push(...entries);
            } catch (error) {
                console.error(`Error reading registry key ${regPath}:`, error);
            }
        }

        // Scan startup folders
        for (const folderPath of this.startupLocations.folders) {
            try {
                const expandedPath = await this.expandEnvironmentPath(folderPath);
                const files = await fs.readdir(expandedPath);
                
                for (const file of files) {
                    const fullPath = path.join(expandedPath, file);
                    const stats = await fs.stat(fullPath);
                    
                    items.push({
                        name: path.parse(file).name,
                        type: path.extname(file),
                        command: fullPath,
                        source: folderPath,
                        enabled: true,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            } catch (error) {
                console.error(`Error reading startup folder ${folderPath}:`, error);
            }
        }

        // Add impact and recommendations
        return items.map(item => ({
            ...item,
            impact: this.getStartupImpact(item.name),
            recommended: this.isRecommended(item.name)
        }));
    }

    async toggleStartupItem(item, enable) {
        try {
            if (item.source.startsWith('HK')) {
                // Registry item
                if (enable) {
                    await execAsync(`reg add "${item.source}" /v "${item.name}" /t REG_SZ /d "${item.command}" /f`);
                } else {
                    await execAsync(`reg delete "${item.source}" /v "${item.name}" /f`);
                }
            } else {
                // Folder item
                const expandedPath = await this.expandEnvironmentPath(item.source);
                const filePath = path.join(expandedPath, item.name + item.type);
                
                if (enable) {
                    // Restore from backup
                    const backupPath = path.join(
                        expandedPath,
                        'disabled',
                        item.name + item.type
                    );
                    await fs.rename(backupPath, filePath);
                } else {
                    // Move to disabled folder
                    const disabledDir = path.join(expandedPath, 'disabled');
                    await fs.mkdir(disabledDir, { recursive: true });
                    await fs.rename(filePath, path.join(disabledDir, item.name + item.type));
                }
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async optimizeStartup() {
        const results = {
            disabled: [],
            failed: []
        };

        const items = await this.getStartupItems();
        
        for (const item of items) {
            if (item.impact === 'high' && !item.recommended) {
                try {
                    await this.toggleStartupItem(item, false);
                    results.disabled.push(item.name);
                } catch (error) {
                    results.failed.push({
                        name: item.name,
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    async addStartupItem(name, command) {
        try {
            const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
            await execAsync(`reg add "${regPath}" /v "${name}" /t REG_SZ /d "${command}" /f`);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getStartupImpact(name) {
        try {
            const { stdout } = await execAsync('wmic process get name,workingsetsize');
            const processes = stdout.split('\n')
                .slice(1)
                .map(line => {
                    const [size, name] = line.trim().split(/\s+/);
                    return { name, size: parseInt(size) || 0 };
                });

            const totalMemory = os.totalmem();
            const process = processes.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
            
            if (process) {
                const memoryUsagePercent = (process.size / totalMemory) * 100;
                if (memoryUsagePercent > 2) return 'high';
                if (memoryUsagePercent > 0.5) return 'medium';
                return 'low';
            }
            
            return this.knownStartupItems[name]?.impact || 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    isRecommended(name) {
        return this.knownStartupItems[name]?.recommended || false;
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
}

module.exports = new StartupManager(); 