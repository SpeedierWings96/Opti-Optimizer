const si = require('systeminformation');
const os = require('os');
const { exec } = require('child_process');
const Store = require('electron-store');

const store = new Store();

class SystemOptimizer {
    constructor() {
        this.optimizations = {
            running: false,
            memoryOptimized: false,
            networkOptimized: false,
            diskOptimized: false
        };
    }

    async getSystemStatus() {
        const [cpu, mem, disk, net] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats()
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
            }
        };
    }

    async optimizeMemory() {
        if (process.platform === 'win32') {
            // Windows memory optimization
            exec('powershell -Command "Empty-RecycleBin -Force -ErrorAction SilentlyContinue"');
            exec('powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"');
            exec('powershell -Command "Stop-Process -Name \"Memory Compression\" -Force -ErrorAction SilentlyContinue"');
        } else if (process.platform === 'linux') {
            // Linux memory optimization
            exec('sync && echo 3 | sudo tee /proc/sys/vm/drop_caches');
            exec('sudo sysctl -w vm.swappiness=10');
        }
        this.optimizations.memoryOptimized = true;
        return true;
    }

    async optimizeNetwork() {
        if (process.platform === 'win32') {
            // Windows network optimization
            exec('ipconfig /flushdns');
            exec('netsh int tcp set global autotuninglevel=normal');
            exec('netsh interface tcp set heuristics disabled');
            exec('netsh interface tcp set global rss=enabled');
        } else if (process.platform === 'linux') {
            // Linux network optimization
            exec('sudo systemctl restart NetworkManager');
            exec('sudo ip tcp_metrics flush');
        }
        this.optimizations.networkOptimized = true;
        return true;
    }

    async optimizeDisk() {
        if (process.platform === 'win32') {
            // Windows disk optimization
            exec('powershell -Command "Optimize-Volume -DriveLetter C -ReTrim -Verbose"');
            exec('cleanmgr /sagerun:1');
        } else if (process.platform === 'linux') {
            // Linux disk optimization
            exec('sudo fstrim -av');
            exec('sudo e4defrag /');
        }
        this.optimizations.diskOptimized = true;
        return true;
    }

    async optimizeGaming() {
        if (process.platform === 'win32') {
            // Gaming optimizations for Windows
            exec('powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'); // High performance power plan
            exec('bcdedit /set useplatformtick yes');
            exec('bcdedit /set disabledynamictick yes');
            exec('reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f');
            exec('reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Priority" /t REG_DWORD /d 6 /f');
        }
        return true;
    }

    async optimizePrivacy() {
        if (process.platform === 'win32') {
            // Privacy optimizations for Windows
            exec('reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v "AllowTelemetry" /t REG_DWORD /d 0 /f');
            exec('reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" /v "EnableActivityFeed" /t REG_DWORD /d 0 /f');
            exec('sc stop DiagTrack');
            exec('sc config DiagTrack start= disabled');
        }
        return true;
    }

    async runAllOptimizations() {
        if (this.optimizations.running) return false;
        this.optimizations.running = true;

        try {
            await Promise.all([
                this.optimizeMemory(),
                this.optimizeNetwork(),
                this.optimizeDisk(),
                this.optimizeGaming(),
                this.optimizePrivacy()
            ]);

            store.set('lastOptimization', new Date().toISOString());
            this.optimizations.running = false;
            return true;
        } catch (error) {
            console.error('Optimization error:', error);
            this.optimizations.running = false;
            return false;
        }
    }

    getOptimizationStatus() {
        return {
            ...this.optimizations,
            lastRun: store.get('lastOptimization')
        };
    }
}

module.exports = new SystemOptimizer(); 