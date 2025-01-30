const si = require('systeminformation');
const os = require('os');
const Store = require('electron-store');

class SystemAnalytics {
    constructor() {
        this.store = new Store();
        this.history = this.store.get('performance_history', {
            cpu: [],
            memory: [],
            temperature: [],
            network: []
        });
        this.maxHistoryLength = 1440; // 24 hours of minute-by-minute data
        this.lastUpdate = 0;
        this.updateInterval = 1000; // 1 second
    }

    async getFullSystemInfo() {
        try {
            const [cpu, memory, disk, network, graphics, battery, system] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.fsSize(),
                si.networkInterfaces(),
                si.graphics(),
                si.battery(),
                si.system()
            ]);

            return {
                system: {
                    manufacturer: system.manufacturer,
                    model: system.model,
                    version: system.version,
                    serial: system.serial,
                    uuid: system.uuid
                },
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    speed: cpu.speed,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores,
                    processors: cpu.processors
                },
                memory: {
                    total: this.formatBytes(memory.total),
                    free: this.formatBytes(memory.free),
                    used: this.formatBytes(memory.used),
                    active: this.formatBytes(memory.active),
                    available: this.formatBytes(memory.available),
                    swapTotal: this.formatBytes(memory.swaptotal),
                    swapUsed: this.formatBytes(memory.swapused)
                },
                disk: disk.map(drive => ({
                    fs: drive.fs,
                    type: drive.type,
                    size: this.formatBytes(drive.size),
                    used: this.formatBytes(drive.used),
                    available: this.formatBytes(drive.available),
                    mount: drive.mount,
                    usePercent: drive.use
                })),
                graphics: graphics.controllers.map(gpu => ({
                    vendor: gpu.vendor,
                    model: gpu.model,
                    vram: gpu.vram,
                    driver: gpu.driver
                })),
                network: network.map(iface => ({
                    iface: iface.iface,
                    type: iface.type,
                    speed: iface.speed,
                    dhcp: iface.dhcp,
                    dns: iface.dns
                })),
                battery: {
                    hasBattery: battery.hasbattery,
                    isCharging: battery.ischarging,
                    percent: battery.percent,
                    timeRemaining: battery.timeremaining
                }
            };
        } catch (error) {
            console.error('Error getting system info:', error);
            return null;
        }
    }

    async getPerformanceMetrics() {
        try {
            if (Date.now() - this.lastUpdate < this.updateInterval) {
                return this.lastMetrics;
            }

            const [currentLoad, temp, mem, net] = await Promise.all([
                si.currentLoad(),
                si.cpuTemperature(),
                si.mem(),
                si.networkStats()
            ]);

            const metrics = {
                cpu: {
                    load: currentLoad.currentLoad,
                    user: currentLoad.currentLoadUser,
                    system: currentLoad.currentLoadSystem,
                    cores: currentLoad.cpus.map(core => ({
                        load: core.load,
                        loadUser: core.loadUser,
                        loadSystem: core.loadSystem
                    }))
                },
                memory: {
                    total: mem.total,
                    used: mem.used,
                    free: mem.free,
                    active: mem.active,
                    available: mem.available,
                    usePercentage: (mem.used / mem.total) * 100
                },
                temperature: {
                    main: temp.main,
                    cores: temp.cores,
                    max: temp.max
                },
                network: {
                    upload: net.reduce((sum, iface) => sum + iface.tx_sec, 0),
                    download: net.reduce((sum, iface) => sum + iface.rx_sec, 0),
                    total: net.reduce((sum, iface) => sum + iface.tx_sec + iface.rx_sec, 0)
                },
                timestamp: Date.now()
            };

            // Update history
            this.updateHistory(metrics);
            
            // Cache metrics
            this.lastMetrics = metrics;
            this.lastUpdate = Date.now();

            return metrics;
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            return null;
        }
    }

    async getPerformanceHistory(duration = '1h') {
        const now = Date.now();
        const periods = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };

        const since = now - (periods[duration] || periods['1h']);
        
        return {
            cpu: this.history.cpu.filter(entry => entry.timestamp > since),
            memory: this.history.memory.filter(entry => entry.timestamp > since),
            temperature: this.history.temperature.filter(entry => entry.timestamp > since),
            network: this.history.network.filter(entry => entry.timestamp > since)
        };
    }

    async getSystemHealth() {
        try {
            const metrics = await this.getPerformanceMetrics();
            const issues = [];
            const warnings = [];
            const recommendations = [];

            // CPU checks
            if (metrics.cpu.load > 90) {
                issues.push('CPU usage is critically high');
                recommendations.push('Consider closing resource-intensive applications');
            } else if (metrics.cpu.load > 70) {
                warnings.push('CPU usage is high');
            }

            // Memory checks
            const memoryUsePercent = (metrics.memory.used / metrics.memory.total) * 100;
            if (memoryUsePercent > 90) {
                issues.push('Memory usage is critically high');
                recommendations.push('Close unnecessary applications or increase RAM');
            } else if (memoryUsePercent > 80) {
                warnings.push('Memory usage is high');
            }

            // Temperature checks
            if (metrics.temperature.main > 85) {
                issues.push('CPU temperature is critically high');
                recommendations.push('Check cooling system and clean dust');
            } else if (metrics.temperature.main > 75) {
                warnings.push('CPU temperature is high');
            }

            return {
                status: issues.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy',
                issues,
                warnings,
                recommendations,
                metrics
            };
        } catch (error) {
            console.error('Error getting system health:', error);
            return null;
        }
    }

    // Helper methods
    updateHistory(metrics) {
        const timestamp = Date.now();
        
        // Update CPU history
        this.history.cpu.push({
            value: metrics.cpu.load,
            timestamp
        });

        // Update memory history
        this.history.memory.push({
            value: metrics.memory.usePercentage,
            timestamp
        });

        // Update temperature history
        this.history.temperature.push({
            value: metrics.temperature.main,
            timestamp
        });

        // Update network history
        this.history.network.push({
            upload: metrics.network.upload,
            download: metrics.network.download,
            timestamp
        });

        // Trim history if needed
        ['cpu', 'memory', 'temperature', 'network'].forEach(metric => {
            if (this.history[metric].length > this.maxHistoryLength) {
                this.history[metric] = this.history[metric].slice(-this.maxHistoryLength);
            }
        });

        // Save to store
        this.store.set('performance_history', this.history);
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new SystemAnalytics(); 