const { InfluxDBClient } = require('@influxdata/influxdb3-client');

let client = null;

// Initialize InfluxDB client (singleton pattern)
function initializeInfluxDB() {
    // Return existing client if already initialized
    if (client) {
        return client;
    }
    
    try {
        const host = process.env.INFLUXDB_HOST || 'http://localhost:8086';
        const token = process.env.INFLUXDB_TOKEN;
        const database = process.env.INFLUXDB_DATABASE || 'monitoring';

        if (!token) {
            throw new Error('INFLUXDB_TOKEN is required in .env file');
        }

        console.log('Initializing InfluxDB Core 3 client...');
        console.log('Host:', host);
        console.log('Database:', database);

        client = new InfluxDBClient({
            host,
            token,
            database
        });

        console.log('✓ InfluxDB Core 3 client initialized');
        return client;
    } catch (error) {
        console.error('✗ InfluxDB initialization error:', error.message);
        throw error;
    }
}

// Write metrics to InfluxDB
async function writeMetrics(data) {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const {
            vmId,
            hostname,
            timestamp,
            cpu,
            memory,
            disk,
            processes,
            services
        } = data;

        // Validate required fields
        if (!vmId || !hostname) {
            console.error('❌ InfluxDB writeMetrics: Missing required fields', { vmId, hostname });
            throw new Error(`Missing required fields: vmId=${vmId}, hostname=${hostname}`);
        }

        // Escape special characters in tag values
        const escapeTag = (str) => {
            if (str === undefined || str === null) {
                return 'unknown';
            }
            try {
                return String(str).replace(/[,= ]/g, '\\$&');
            } catch (error) {
                console.error('❌ InfluxDB escapeTag error:', error.message, 'Value:', str);
                return 'unknown';
            }
        };
        
        const escapedVmId = escapeTag(vmId);
        const escapedHostname = escapeTag(hostname);

        // Build line protocol format
        const lines = [];
        const ts = new Date(timestamp).getTime() * 1000000;

        // CPU metrics
        const coresStr = cpu.cores ? cpu.cores.join(',') : '';
        lines.push(
            `cpu,vm_id=${escapedVmId},hostname=${escapedHostname} ` +
            `usage=${cpu.usage},cores="${coresStr}" ` +
            `${ts}`
        );

        // Memory metrics
        lines.push(
            `memory,vm_id=${escapedVmId},hostname=${escapedHostname} ` +
            `total=${memory.total}i,used=${memory.used}i,percent=${memory.percent} ` +
            `${ts}`
        );

        // Disk metrics
        if (disk && disk.total !== undefined) {
            lines.push(
                `disk,vm_id=${escapedVmId},hostname=${escapedHostname} ` +
                `total=${disk.total}i,used=${disk.used}i,percent=${disk.percent} ` +
                `${ts}`
            );
        }

        // Process metrics
        if (processes && Array.isArray(processes) && processes.length > 0) {
            processes.slice(0, 5).forEach((proc, index) => {
                if (!proc) return;
                
                const rank = index + 1;
                const procName = escapeTag(proc.name || 'unknown');
                const cpuPercent = proc.cpu_percent || 0;
                const memPercent = proc.memory_percent || 0;
                const pid = proc.pid || 0;
                
                lines.push(
                    `processes,vm_id=${escapedVmId},hostname=${escapedHostname},rank=${rank},name=${procName} ` +
                    `cpu=${cpuPercent},mem=${memPercent},pid=${pid}i ` +
                    `${ts}`
                );
            });
        }

        // Service metrics
        if (services && typeof services === 'object') {
            for (const [serviceName, serviceData] of Object.entries(services)) {
                if (!serviceName || !serviceData) continue;
                
                const state = serviceData.state || 'unknown';
                const stateValue = state === 'healthy' ? 1 : state === 'degraded' ? 0.5 : 0;
                const escapedServiceName = escapeTag(serviceName);
                const escapedState = String(state).replace(/\n/g, ' ').replace(/"/g, '\\"');
                
                lines.push(
                    `services,vm_id=${escapedVmId},hostname=${escapedHostname},service=${escapedServiceName} ` +
                    `state="${escapedState}",state_value=${stateValue} ` +
                    `${ts}`
                );
            }
        }

        const lineProtocol = lines.join('\n');
        await client.write(lineProtocol, process.env.INFLUXDB_DATABASE || 'monitoring');
        
        return { success: true };
    } catch (error) {
        console.error('✗ Error writing to InfluxDB:', error.message);
        console.error('Stack trace:', error.stack);
        console.error('Data received:', JSON.stringify(data, null, 2));
        throw error;
    }
}

// Query metrics from InfluxDB
async function queryMetrics(vmId, startTime, limit = 100) {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const startTimeMs = new Date(startTime).getTime();
        const startTimeSec = Math.floor(startTimeMs / 1000); // Convert to seconds as integer
        
        // Query using SQL
        const query = `
            SELECT 
                time,
                vm_id,
                hostname,
                usage as cpu_usage,
                cores as cpu_cores
            FROM cpu
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
            ORDER BY time DESC
            LIMIT ${limit}
        `;

        const memoryQuery = `
            SELECT 
                time,
                total as memory_total,
                used as memory_used,
                percent as memory_percent
            FROM memory
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
            ORDER BY time DESC
            LIMIT ${limit}
        `;

        const diskQuery = `
            SELECT 
                time,
                total as disk_total,
                used as disk_used,
                percent as disk_percent
            FROM disk
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
            ORDER BY time DESC
            LIMIT ${limit}
        `;

        const processesQuery = `
            SELECT 
                time,
                rank,
                name,
                cpu,
                mem,
                pid
            FROM processes
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
            ORDER BY time DESC, rank ASC
            LIMIT ${limit * 5}
        `;

        const servicesQuery = `
            SELECT 
                time,
                service,
                state,
                state_value
            FROM services
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
            ORDER BY time DESC
            LIMIT ${limit * 10}
        `;

        // Execute queries
        const cpuResults = [];
        const memoryResults = [];
        const diskResults = [];
        const processesResults = [];
        const servicesResults = [];

        for await (const row of client.query(query, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            cpuResults.push(row);
        }

        for await (const row of client.query(memoryQuery, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            memoryResults.push(row);
        }

        for await (const row of client.query(diskQuery, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            diskResults.push(row);
        }

        try {
            for await (const row of client.query(processesQuery, process.env.INFLUXDB_DATABASE || 'monitoring')) {
                processesResults.push(row);
            }
        } catch (e) {
            console.log('No processes data available');
        }

        try {
            for await (const row of client.query(servicesQuery, process.env.INFLUXDB_DATABASE || 'monitoring')) {
                servicesResults.push(row);
            }
        } catch (e) {
            console.log('No services data available');
        }

        // Merge results by timestamp
        const metrics = cpuResults.map((cpuRow, index) => {
            const memRow = memoryResults[index] || {};
            const diskRow = diskResults[index] || {};
            
            // Group services by timestamp
            const timestamp = new Date(cpuRow.time).getTime();
            const servicesForTime = servicesResults.filter(s => 
                Math.abs(new Date(s.time).getTime() - timestamp) < 1000
            );
            
            const servicesObj = {};
            servicesForTime.forEach(s => {
                servicesObj[s.service] = {
                    state: s.state,
                    checks: {}
                };
            });

            // Group processes by timestamp
            const processesForTime = processesResults.filter(p => 
                Math.abs(new Date(p.time).getTime() - timestamp) < 1000
            );
            
            const processes = processesForTime.map(p => ({
                name: p.name,
                cpu_percent: p.cpu || 0,
                memory_percent: p.mem || 0,
                pid: Number(p.pid || 0)
            }));

            return {
                vmId: cpuRow.vm_id,
                hostname: cpuRow.hostname,
                timestamp: new Date(cpuRow.time),
                cpu: {
                    usage: cpuRow.cpu_usage,
                    cores: cpuRow.cpu_cores ? cpuRow.cpu_cores.split(',').map(Number) : []
                },
                memory: {
                    total: Number(memRow.memory_total || 0),
                    used: Number(memRow.memory_used || 0),
                    percent: Number(memRow.memory_percent || 0)
                },
                disk: {
                    total: Number(diskRow.disk_total || 0),
                    used: Number(diskRow.disk_used || 0),
                    percent: Number(diskRow.disk_percent || 0)
                },
                processes: processes.length > 0 ? processes : undefined,
                services: Object.keys(servicesObj).length > 0 ? servicesObj : undefined
            };
        });

        return metrics;
    } catch (error) {
        console.error('✗ Error querying InfluxDB:', error.message);
        throw error;
    }
}

// Query metrics with custom date range
async function queryMetricsRange(vmId, startTime, endTime, limit = 100) {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const startTimeSec = Math.floor(new Date(startTime).getTime() / 1000);
        const endTimeSec = Math.floor(new Date(endTime).getTime() / 1000);
        
        const query = `
            SELECT 
                time,
                vm_id,
                hostname,
                usage as cpu_usage,
                cores as cpu_cores
            FROM cpu
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
                AND time <= from_unixtime(${endTimeSec})
            ORDER BY time DESC
            LIMIT ${limit}
        `;

        const results = [];
        for await (const row of client.query(query, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            results.push({
                vmId: row.vm_id,
                hostname: row.hostname,
                timestamp: new Date(row.time),
                cpu: {
                    usage: row.cpu_usage,
                    cores: row.cpu_cores ? row.cpu_cores.split(',').map(Number) : []
                },
                memory: { total: 0, used: 0, percent: 0 },
                disk: { total: 0, used: 0, percent: 0 }
            });
        }

        return results;
    } catch (error) {
        console.error('✗ Error querying InfluxDB range:', error.message);
        throw error;
    }
}

// Delete old metrics
async function deleteMetrics(vmId, cutoffDate) {
    // InfluxDB Core 3 doesn't support DELETE in the same way
    // This would typically be handled by retention policies
    console.warn('⚠ Delete operation not fully supported in InfluxDB Core 3');
    console.warn('💡 Consider using retention policies instead');
    return { deletedCount: 0 };
}

// Get storage statistics
async function getStats() {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        // Query for basic statistics - total records
        const recordsQuery = `
            SELECT COUNT(*) as total_records
            FROM cpu
        `;

        let totalRecords = 0;
        for await (const row of client.query(recordsQuery, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            // Convert BigInt to Number for JSON serialization
            totalRecords = Number(row.total_records || 0);
        }

        // Get per-VM statistics
        const vmStatsQuery = `
            SELECT 
                vm_id,
                COUNT(*) as total_records,
                MIN(time) as oldest_record,
                MAX(time) as newest_record
            FROM cpu
            GROUP BY vm_id
        `;

        const vmStats = [];
        try {
            for await (const row of client.query(vmStatsQuery, process.env.INFLUXDB_DATABASE || 'monitoring')) {
                vmStats.push({
                    _id: row.vm_id,
                    totalRecords: typeof row.total_records === 'bigint' ? Number(row.total_records) : Number(row.total_records || 0),
                    oldestRecord: row.oldest_record ? new Date(row.oldest_record) : null,
                    newestRecord: row.newest_record ? new Date(row.newest_record) : null,
                    hostname: row.vm_id // Use vm_id as fallback for hostname
                });
            }
        } catch (vmError) {
            console.log('Note: Could not query VM stats:', vmError.message);
        }

        return {
            totalRecords,
            database: process.env.INFLUXDB_DATABASE || 'monitoring',
            type: 'influxdb',
            vmStats
        };
    } catch (error) {
        console.error('✗ Error getting InfluxDB stats:', error.message);
        return {
            totalRecords: 0,
            database: process.env.INFLUXDB_DATABASE || 'monitoring',
            type: 'influxdb',
            vmStats: [],
            error: error.message
        };
    }
}

// Helper function to format bytes
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get storage statistics for a specific VM
async function getVMStats(vmId) {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const tables = ['cpu', 'memory', 'disk', 'processes', 'services', 'alerts'];
        let totalRecords = 0;

        for (const table of tables) {
            try {
                const query = `
                    SELECT COUNT(*) as count
                    FROM ${table}
                    WHERE vm_id = '${vmId}'
                `;

                for await (const row of client.query(query, process.env.INFLUXDB_DATABASE || 'monitoring')) {
                    totalRecords += Number(row.count || 0);
                }
            } catch (e) {
                // Table might not exist or have data
                console.log(`Note: Could not query ${table} for VM ${vmId}`);
            }
        }

        return {
            vmId,
            totalRecords,
            database: process.env.INFLUXDB_DATABASE || 'monitoring',
            type: 'influxdb'
        };
    } catch (error) {
        console.error(`✗ Error getting VM stats for ${vmId}:`, error.message);
        return {
            vmId,
            totalRecords: 0,
            database: process.env.INFLUXDB_DATABASE || 'monitoring',
            type: 'influxdb',
            error: error.message
        };
    }
}

// Write alert to InfluxDB
async function writeAlert(alertData) {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const {
            vmId,
            hostname,
            metricType,
            severity,
            thresholdValue,
            currentValue,
            message,
            triggeredAt
        } = alertData;

        // Escape special characters for line protocol
        const escapeTag = (str) => {
            if (str === undefined || str === null) return 'unknown';
            return String(str).replace(/[,= ]/g, '\\$&');
        };
        
        const escapeFieldValue = (str) => {
            if (str === undefined || str === null) return '';
            return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        };

        const timestamp = new Date(triggeredAt || Date.now()).getTime() * 1000000;

        const lineProtocol = 
            `alerts,vm_id=${escapeTag(vmId)},hostname=${escapeTag(hostname)},metric_type=${escapeTag(metricType)},severity=${escapeTag(severity)} ` +
            `threshold_value="${escapeFieldValue(thresholdValue)}",current_value="${escapeFieldValue(currentValue)}",message="${escapeFieldValue(message)}" ` +
            `${timestamp}`;

        await client.write(lineProtocol, process.env.INFLUXDB_DATABASE || 'monitoring');
        
        // Return the complete alert object for email notifications
        return {
            vm_id: vmId,
            hostname: hostname,
            metric_type: metricType,
            severity: severity,
            threshold_value: thresholdValue,
            current_value: currentValue,
            message: message,
            triggered_at: triggeredAt || new Date()
        };
    } catch (error) {
        console.error('✗ Error writing alert to InfluxDB:', error.message);
        throw error;
    }
}

// Query alerts from InfluxDB
async function queryAlerts(vmId, options = {}) {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const { severity, metricType, startTime, limit = 100 } = options;

        let whereClause = `vm_id = '${vmId}'`;
        
        if (severity) {
            whereClause += ` AND severity = '${severity}'`;
        }
        
        if (metricType) {
            whereClause += ` AND metric_type = '${metricType}'`;
        }
        
        if (startTime) {
            const startTimeSec = Math.floor(new Date(startTime).getTime() / 1000);
            whereClause += ` AND time >= from_unixtime(${startTimeSec})`;
        }

        const query = `
            SELECT 
                time,
                vm_id,
                hostname,
                metric_type,
                severity,
                threshold_value,
                current_value,
                message
            FROM alerts
            WHERE ${whereClause}
            ORDER BY time DESC
            LIMIT ${limit}
        `;

        const alerts = [];
        let idCounter = 1;
        for await (const row of client.query(query, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            // Ensure time is properly converted to Date
            let triggeredAt;
            try {
                triggeredAt = row.time ? new Date(row.time) : new Date();
            } catch (e) {
                triggeredAt = new Date();
            }
            
            // Generate a unique ID for React key (InfluxDB doesn't have auto-increment IDs)
            const id = `${row.vm_id}_${triggeredAt.getTime()}_${idCounter++}`;
            
            alerts.push({
                id: id,
                vmId: row.vm_id,
                hostname: row.hostname,
                metric_type: row.metric_type,
                severity: row.severity,
                threshold_value: row.threshold_value,
                current_value: row.current_value,
                message: row.message,
                triggered_at: triggeredAt.toISOString() // Use snake_case to match TimescaleDB
            });
        }

        return alerts;
    } catch (error) {
        console.error('✗ Error querying alerts from InfluxDB:', error.message);
        throw error;
    }
}

// Get alert statistics
async function getAlertStats(vmId, period = '24h') {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const periodMap = {
            '1h': 1,
            '6h': 6,
            '24h': 24,
            '7d': 168,
            '30d': 720
        };

        const hours = periodMap[period] || 24;
        const nowMs = Date.now();
        const offsetMs = hours * 60 * 60 * 1000;
        const startTimeMs = nowMs - offsetMs;
        const startTimeSec = Math.floor(startTimeMs / 1000);

        const query = `
            SELECT 
                severity,
                COUNT(*) as count
            FROM alerts
            WHERE vm_id = '${vmId}' 
                AND time >= from_unixtime(${startTimeSec})
            GROUP BY severity
        `;

        const stats = { warning_count: 0, critical_count: 0, total_count: 0 };
        
        for await (const row of client.query(query, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            // Convert BigInt to Number explicitly
            const count = typeof row.count === 'bigint' ? Number(row.count) : (Number(row.count) || 0);
            if (row.severity === 'warning') {
                stats.warning_count = count;
            } else if (row.severity === 'critical') {
                stats.critical_count = count;
            }
            stats.total_count = stats.total_count + count; // Ensure both are Numbers
        }

        return stats;
    } catch (error) {
        console.error('✗ Error getting alert stats from InfluxDB:', error.message);
        return { warning_count: 0, critical_count: 0, total_count: 0 };
    }
}

// Close InfluxDB client
async function close() {
    if (client) {
        try {
            await client.close();
            console.log('✓ InfluxDB client closed');
        } catch (error) {
            console.error('✗ Error closing InfluxDB client:', error.message);
        }
    }
}

// Get unique VMs
async function getUniqueVMs() {
    if (!client) {
        throw new Error('InfluxDB client not initialized');
    }

    try {
        const query = `
            SELECT DISTINCT vm_id, hostname, time
            FROM cpu
            ORDER BY time DESC
        `;
        
        const vms = [];
        
        for await (const row of client.query(query, process.env.INFLUXDB_DATABASE || 'monitoring')) {
            if (!vms.find(vm => vm.vm_id === row.vm_id)) {
                vms.push({
                    vm_id: row.vm_id,
                    hostname: row.hostname,
                    timestamp: new Date(row.time)
                });
            }
        }
        
        return vms;
    } catch (error) {
        console.error('✗ Error getting unique VMs from InfluxDB:', error.message);
        return [];
    }
}

module.exports = {
    initializeInfluxDB,
    writeMetrics,
    queryMetrics,
    queryMetricsRange,
    deleteMetrics,
    getStats,
    getVMStats,
    writeAlert,
    queryAlerts,
    getAlertStats,
    getUniqueVMs,
    close
};
