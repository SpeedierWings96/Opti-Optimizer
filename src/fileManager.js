const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const Store = require('electron-store');

class FileManager {
    constructor() {
        this.store = new Store();
        this.protectedPaths = [
            'C:\\Windows',
            'C:\\Program Files',
            'C:\\Program Files (x86)',
            'C:\\Users\\Default',
            'C:\\ProgramData'
        ];
        this.knownBloatware = {
            'Candy Crush': {
                paths: ['Microsoft.549981C3F5F10_*'],
                regKeys: ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CandyCrush']
            },
            'Xbox Apps': {
                paths: ['Microsoft.XboxApp_*', 'Microsoft.XboxIdentityProvider_*'],
                regKeys: ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Xbox']
            },
            'Skype': {
                paths: ['Microsoft.SkypeApp_*'],
                regKeys: ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Skype']
            },
            '3D Builder': {
                paths: ['Microsoft.3DBuilder_*'],
                regKeys: []
            },
            'Get Help': {
                paths: ['Microsoft.GetHelp_*'],
                regKeys: []
            },
            'Mixed Reality Portal': {
                paths: ['Microsoft.MixedReality.Portal_*'],
                regKeys: []
            }
        };
    }

    async scanDirectory(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            if (!stats.isDirectory()) {
                throw new Error('Path is not a directory');
            }

            const items = await fs.readdir(dirPath, { withFileTypes: true });
            const results = [];

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const itemStats = await fs.stat(fullPath).catch(() => null);
                
                if (itemStats) {
                    results.push({
                        name: item.name,
                        path: fullPath,
                        type: item.isDirectory() ? 'directory' : 'file',
                        size: itemStats.size,
                        created: itemStats.birthtime,
                        modified: itemStats.mtime,
                        accessed: itemStats.atime,
                        isHidden: (itemStats.mode & 0x4000) !== 0,
                        isSystem: (itemStats.mode & 0x800) !== 0
                    });
                }
            }

            return {
                success: true,
                items: results,
                totalItems: results.length,
                totalSize: results.reduce((sum, item) => sum + item.size, 0)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteFiles(paths, secure = false) {
        const results = {
            success: [],
            failed: []
        };

        for (const filePath of paths) {
            try {
                // Check if path is protected
                if (this.protectedPaths.some(protected => filePath.startsWith(protected))) {
                    throw new Error('Cannot delete protected system path');
                }

                const stats = await fs.stat(filePath);
                
                if (stats.isDirectory()) {
                    if (secure) {
                        // Secure directory deletion (overwrite files first)
                        await this.secureDeleteDirectory(filePath);
                    } else {
                        await fs.rmdir(filePath, { recursive: true });
                    }
                } else {
                    if (secure) {
                        await this.secureDeleteFile(filePath);
                    } else {
                        await fs.unlink(filePath);
                    }
                }

                results.success.push(filePath);
            } catch (error) {
                results.failed.push({
                    path: filePath,
                    error: error.message
                });
            }
        }

        return results;
    }

    async secureDeleteFile(filePath) {
        const stats = await fs.stat(filePath);
        const fileHandle = await fs.open(filePath, 'r+');
        
        try {
            // Overwrite with random data
            const buffer = Buffer.alloc(stats.size);
            for (let i = 0; i < 3; i++) {
                buffer.fill(Math.random() * 255);
                await fileHandle.write(buffer, 0, buffer.length);
                await fileHandle.sync();
            }
            
            // Overwrite with zeros
            buffer.fill(0);
            await fileHandle.write(buffer, 0, buffer.length);
            await fileHandle.sync();
            
            await fileHandle.close();
            await fs.unlink(filePath);
        } catch (error) {
            await fileHandle.close();
            throw error;
        }
    }

    async secureDeleteDirectory(dirPath) {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                await this.secureDeleteDirectory(fullPath);
            } else {
                await this.secureDeleteFile(fullPath);
            }
        }
        
        await fs.rmdir(dirPath);
    }

    async findLargeFiles(minSize = 100 * 1024 * 1024) { // Default 100MB
        const results = [];
        const drives = await this.getFixedDrives();

        for (const drive of drives) {
            try {
                const { stdout } = await execAsync(
                    `forfiles /S /P ${drive} /M *.* /C "cmd /c if @fsize GEQ ${minSize} echo @path @fsize"`
                );

                const files = stdout.split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const [path, size] = line.trim().split(' ');
                        return {
                            path: path.replace(/"/g, ''),
                            size: parseInt(size)
                        };
                    });

                results.push(...files);
            } catch (error) {
                console.error(`Error scanning ${drive}:`, error);
            }
        }

        return results;
    }

    async findDuplicateFiles(directory) {
        const fileHashes = new Map();
        const duplicates = [];

        async function getFileHash(filePath) {
            const { stdout } = await execAsync(`certutil -hashfile "${filePath}" MD5`);
            return stdout.split('\n')[1].trim();
        }

        async function scanDirectory(dir) {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    await scanDirectory(fullPath);
                } else {
                    const hash = await getFileHash(fullPath);
                    
                    if (fileHashes.has(hash)) {
                        duplicates.push({
                            original: fileHashes.get(hash),
                            duplicate: fullPath,
                            size: (await fs.stat(fullPath)).size
                        });
                    } else {
                        fileHashes.set(hash, fullPath);
                    }
                }
            }
        }

        await scanDirectory(directory);
        return duplicates;
    }

    async removeBloatware() {
        const results = {
            removed: [],
            failed: []
        };

        for (const [name, app] of Object.entries(this.knownBloatware)) {
            try {
                // Remove app packages
                for (const pathPattern of app.paths) {
                    await execAsync(`powershell -Command "Get-AppxPackage ${pathPattern} | Remove-AppxPackage"`);
                }

                // Remove registry entries
                for (const regKey of app.regKeys) {
                    await execAsync(`reg delete "${regKey}" /f`).catch(() => {});
                }

                results.removed.push(name);
            } catch (error) {
                results.failed.push({
                    name,
                    error: error.message
                });
            }
        }

        return results;
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

    async getDriveInfo() {
        const drives = await this.getFixedDrives();
        const results = [];

        for (const drive of drives) {
            try {
                const { stdout: typeInfo } = await execAsync(
                    `wmic diskdrive where "DeviceID like '%${drive.replace(':', '')}%'" get MediaType`
                );
                const { stdout: spaceInfo } = await execAsync(
                    `wmic logicaldisk where "Caption='${drive}'" get Size,FreeSpace`
                );

                const [, freeSpace, size] = spaceInfo.split(/\s+/).filter(Boolean);

                results.push({
                    drive,
                    type: typeInfo.toLowerCase().includes('ssd') ? 'SSD' : 'HDD',
                    totalSpace: parseInt(size),
                    freeSpace: parseInt(freeSpace),
                    usedSpace: parseInt(size) - parseInt(freeSpace),
                    usagePercent: ((parseInt(size) - parseInt(freeSpace)) / parseInt(size) * 100).toFixed(2)
                });
            } catch (error) {
                console.error(`Error getting info for ${drive}:`, error);
            }
        }

        return results;
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new FileManager(); 