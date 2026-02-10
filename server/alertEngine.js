const Alert = require('./models/Alert');
const emailNotifier = require('./emailNotifier');

class AlertEngine {
    constructor() {
        // Alert rules configuration
        this.rules = {
            cpu_usage: {
                warning: { threshold: 80, duration: 5 * 60 * 1000 }, // 5 minutes
                critical: { threshold: 90, duration: 5 * 60 * 1000 }
            },
            load_average: {
                warning: { multiplier: 1.5, duration: 5 * 60 * 1000 },
                critical: { multiplier: 2.0, duration: 5 * 60 * 1000 }
            },
            memory_usage: {
                warning: { threshold: 80, duration: 0 },
                critical: { threshold: 90, duration: 0 }
            },
            swap_usage: {
                warning: { threshold: 60, duration: 0 },
                critical: { threshold: 90, duration: 0 }
            },
            disk_usage: {
                warning: { threshold: 85, duration: 0 },
                critical: { threshold: 95, duration: 0 }
            },
            disk_inodes: {
                warning: { threshold: 85, duration: 0 },
                critical: { threshold: 95, duration: 0 }
            },
            disk_io_wait: {
                warning: { threshold: 20, duration: 0 },
                critical: { threshold: 40, duration: 0 }
            }
        };

        // Track sustained violations for duration-based alerts
        // Structure: { vmId: { metricType: { firstViolation: timestamp, lastValue: value } } }
        this.violationTracker = {};

        // Track recent alerts to prevent spam (simple cooldown)
        // Structure: { vmId: { metricType_severity: lastAlertTime } }
        this.recentAlerts = {};
        this.alertCooldown = 5 * 60 * 1000; // 5 minutes cooldown between same alerts
    }

    /**
     * Evaluate metrics and trigger alerts if thresholds are exceeded
     */
    async evaluateMetrics(metrics) {
        const alerts = [];
        const vmId = metrics.vmId;
        const hostname = metrics.hostname;

        // Initialize tracking for this VM
        if (!this.violationTracker[vmId]) {
            this.violationTracker[vmId] = {};
        }
        if (!this.recentAlerts[vmId]) {
            this.recentAlerts[vmId] = {};
        }

        // 1. CPU Usage
        if (metrics.cpu && metrics.cpu.usage !== undefined) {
            const cpuAlerts = await this.checkThreshold(
                vmId, hostname, 'cpu_usage', metrics.cpu.usage,
                this.rules.cpu_usage,
                'CPU Usage',
                '%'            );
            alerts.push(...cpuAlerts);
        }

        // 2. Load Average (if available)
        if (metrics.cpu && metrics.cpu.cores && metrics.loadAverage) {
            const loadAlerts = await this.checkLoadAverage(
                vmId, hostname, metrics.loadAverage, metrics.cpu.cores
            );
            alerts.push(...loadAlerts);
        }

        // 3. Memory Usage
        if (metrics.memory && metrics.memory.percent !== undefined) {
            const memAlerts = await this.checkThreshold(
                vmId, hostname, 'memory_usage', metrics.memory.percent,
                this.rules.memory_usage,
                'RAM Usage',
                '%'            );
            alerts.push(...memAlerts);
        }

        // 4. Swap Usage (if available)
        if (metrics.swap && metrics.swap.percent !== undefined) {
            const swapAlerts = await this.checkThreshold(
                vmId, hostname, 'swap_usage', metrics.swap.percent,
                this.rules.swap_usage,
                'Swap Usage',
                '%'
            );
            alerts.push(...swapAlerts);
        }

        // 5. Disk Usage
        if (metrics.disk && metrics.disk.percent !== undefined) {
            const diskAlerts = await this.checkThreshold(
                vmId, hostname, 'disk_usage', metrics.disk.percent,
                this.rules.disk_usage,
                'Disk Space',
                '%'            );
            alerts.push(...diskAlerts);
        }

        // 6. Disk Inodes (if available)
        if (metrics.disk && metrics.disk.inodesPercent !== undefined) {
            const inodeAlerts = await this.checkThreshold(
                vmId, hostname, 'disk_inodes', metrics.disk.inodesPercent,
                this.rules.disk_inodes,
                'Inodes Usage',
                '%'            );
            alerts.push(...inodeAlerts);
        }

        // 7. Disk I/O Wait (if available)
        if (metrics.disk && metrics.disk.ioWait !== undefined) {
            const ioAlerts = await this.checkThreshold(
                vmId, hostname, 'disk_io_wait', metrics.disk.ioWait,
                this.rules.disk_io_wait,
                'Disk I/O Wait',
                '%'            );
            alerts.push(...ioAlerts);
        }

        // 8. Service Status
        if (metrics.services) {
            const serviceAlerts = await this.checkServices(vmId, hostname, metrics.services);
            alerts.push(...serviceAlerts);
        }

        return alerts;
    }

    /**
     * Check threshold-based alerts with optional duration
     */
    async checkThreshold(vmId, hostname, metricType, currentValue, rule, metricName, unit, reason) {
        const alerts = [];
        const now = Date.now();

        // Check critical threshold
        if (currentValue > rule.critical.threshold) {
            const alertKey = `${metricType}_critical`;
            
            // Check if duration requirement is met
            if (rule.critical.duration > 0) {
                if (!this.violationTracker[vmId][metricType]) {
                    this.violationTracker[vmId][metricType] = {
                        firstViolation: now,
                        lastValue: currentValue,
                        level: 'critical'
                    };
                    return alerts; // Wait for duration
                }

                const violation = this.violationTracker[vmId][metricType];
                const elapsed = now - violation.firstViolation;

                if (elapsed < rule.critical.duration) {
                    violation.lastValue = currentValue;
                    return alerts; // Still waiting
                }
            }

            // Duration met or not required, check cooldown
            if (!this.recentAlerts[vmId][alertKey] || (now - this.recentAlerts[vmId][alertKey]) > this.alertCooldown) {
                const alert = await this.createAlert(
                    vmId, hostname, metricType, 'critical',
                    rule.critical.threshold, currentValue,
                    `${metricName}: ${currentValue.toFixed(2)}${unit} (threshold: ${rule.critical.threshold}${unit})`
                );
                alerts.push(alert);
                this.recentAlerts[vmId][alertKey] = now;
            }
        }
        // Check warning threshold
        else if (currentValue > rule.warning.threshold) {
            const alertKey = `${metricType}_warning`;
            
            // Check if duration requirement is met
            if (rule.warning.duration > 0) {
                if (!this.violationTracker[vmId][metricType]) {
                    this.violationTracker[vmId][metricType] = {
                        firstViolation: now,
                        lastValue: currentValue,
                        level: 'warning'
                    };
                    return alerts;
                }

                const violation = this.violationTracker[vmId][metricType];
                const elapsed = now - violation.firstViolation;

                if (elapsed < rule.warning.duration) {
                    violation.lastValue = currentValue;
                    return alerts;
                }
            }

            // Duration met or not required, check cooldown
            if (!this.recentAlerts[vmId][alertKey] || (now - this.recentAlerts[vmId][alertKey]) > this.alertCooldown) {
                const alert = await this.createAlert(
                    vmId, hostname, metricType, 'warning',
                    rule.warning.threshold, currentValue,
                    `${metricName}: ${currentValue.toFixed(2)}${unit} (threshold: ${rule.warning.threshold}${unit})`
                );
                alerts.push(alert);
                this.recentAlerts[vmId][alertKey] = now;
            }
        } else {
            // Value is below thresholds, clear tracking
            delete this.violationTracker[vmId][metricType];
        }

        return alerts;
    }

    /**
     * Check load average alerts
     */
    async checkLoadAverage(vmId, hostname, loadAverage, cores) {
        const alerts = [];
        const load1min = loadAverage[0]; // 1-minute load average
        
        const warningThreshold = cores * this.rules.load_average.warning.multiplier;
        const criticalThreshold = cores * this.rules.load_average.critical.multiplier;

        const rule = {
            warning: { threshold: warningThreshold, duration: this.rules.load_average.warning.duration },
            critical: { threshold: criticalThreshold, duration: this.rules.load_average.critical.duration }
        };

        return this.checkThreshold(
            vmId, hostname, 'load_average', load1min, rule,
            'Load Average',
            '',
            `Load Average shows the queue of processes waiting for CPU. Current: ${load1min.toFixed(2)}, Cores: ${cores}`
        );
    }

    /**
     * Check service status and create alerts for stopped services
     */
    async checkServices(vmId, hostname, services) {
        const alerts = [];
        const now = Date.now();

        for (const [serviceName, serviceData] of Object.entries(services)) {
            const metricType = `service_${serviceName}`;
            const alertKey = `${metricType}_critical`;

            // Check if service is down or degraded
            if (serviceData.state === 'down') {
                // Check cooldown
                if (!this.recentAlerts[vmId][alertKey] || (now - this.recentAlerts[vmId][alertKey]) > this.alertCooldown) {
                    const checksInfo = Object.entries(serviceData.checks || {})
                        .map(([check, result]) => `${check}: ${result.message}`)
                        .join(', ');

                    const alert = await this.createAlert(
                        vmId, hostname, metricType, 'critical',
                        'running', 'down',
                        `Service '${serviceName}' is DOWN. ${checksInfo}`
                    );
                    alerts.push(alert);
                    this.recentAlerts[vmId][alertKey] = now;
                }
            } else if (serviceData.state === 'degraded') {
                const warningKey = `${metricType}_warning`;
                // Check cooldown
                if (!this.recentAlerts[vmId][warningKey] || (now - this.recentAlerts[vmId][warningKey]) > this.alertCooldown) {
                    const checksInfo = Object.entries(serviceData.checks || {})
                        .map(([check, result]) => `${check}: ${result.message}`)
                        .join(', ');

                    const alert = await this.createAlert(
                        vmId, hostname, metricType, 'warning',
                        'healthy', 'degraded',
                        `Service '${serviceName}' is DEGRADED. Running but failing health checks. ${checksInfo}`
                    );
                    alerts.push(alert);
                    this.recentAlerts[vmId][warningKey] = now;
                }
            }
        }

        return alerts;
    }

    /**
     * Create a new alert
     */
    async createAlert(vmId, hostname, metricType, severity, thresholdValue, currentValue, message) {
        const alertData = {
            vmId,
            hostname,
            metricType,
            severity,
            thresholdValue: String(thresholdValue),
            currentValue: String(currentValue),
            message,
            triggeredAt: new Date()
        };

        const alert = await Alert.save(alertData);
        console.log(`Alert triggered: [${severity.toUpperCase()}] ${message}`);
        
        // Send email notification (async, don't wait)
        emailNotifier.sendAlertNotification(alert, { vmId, hostname }).catch(err => {
            console.error('Email notification failed:', err.message);
        });
        
        return alert;
    }

    /**
     * Update alert rules
     */
    updateRules(newRules) {
        this.rules = { ...this.rules, ...newRules };
        console.log('Alert rules updated');
    }

    /**
     * Get current rules
     */
    getRules() {
        return this.rules;
    }
}

module.exports = new AlertEngine();
