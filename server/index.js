require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, initializeDatabase } = require('./db');
const Metric = require('./models/Metric');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 5000;

// Initialize TimescaleDB
(async () => {
    try {
        await initializeDatabase();
        console.log('✓ TimescaleDB ready');
        console.log('Database:', process.env.PGDATABASE || 'monitoring_sys');
    } catch (err) {
        console.error('✗ TimescaleDB initialization error:', err.message);
        console.error('💡 Please check:');
        console.error('   1. PostgreSQL/TimescaleDB is running');
        console.error('   2. Database credentials in .env are correct');
        console.error('   3. Database exists or user has CREATE privileges');
        process.exit(1);
    }
})();

// Handle process termination
process.on('SIGINT', async () => {
    await pool.end();
    console.log('TimescaleDB connection pool closed');
    process.exit(0);
});

// Middleware
app.use(cors());
app.use(express.json());

// Discovery Registry
// Structure: { [vmId]: { hostname, ip, port, lastSeen } }
const registry = {};

// Clean up old agents every minute
setInterval(() => {
    const now = Date.now();
    for (const vmId in registry) {
        if (now - registry[vmId].lastSeen > 60000 * 2) { // 2 mins timeout
            delete registry[vmId];
        }
    }
}, 60000);

// Routes

// 1. Agent Registration / Heartbeat
app.post('/api/register', (req, res) => {
    const { vmId, hostname, ip, port, broadcastInterval, storageInterval } = req.body;
    if (!vmId || !port) return res.status(400).json({ error: 'Missing fields' });

    registry[vmId] = {
        vmId,
        hostname,
        ip,
        port,
        lastSeen: Date.now(),
        status: 'online',
        broadcastInterval: broadcastInterval || 0.5,
        storageInterval: storageInterval || 5
    };

    console.log(`Registered/Heartbeat: ${vmId} at ${ip}:${port} (broadcast: ${broadcastInterval}s, storage: ${storageInterval}s)`);
    res.json({ success: true });
});

// 2. Get All VMs (Discovery List)
app.get('/api/vms', (req, res) => {
    // Convert registry to array
    const vms = Object.values(registry).map(agent => ({
        _id: agent.vmId,
        hostname: agent.hostname,
        ip: agent.ip,
        port: agent.port,
        lastSeen: new Date(agent.lastSeen),
        status: (Date.now() - agent.lastSeen) > 40000 ? 'offline' : 'online'
    }));
    res.json(vms);
});

// 3. Get Historical Metrics
app.get('/api/metrics/:vmId', async (req, res) => {
    try {
        const { vmId } = req.params;
        const { period, limit = 100, startDate, endDate } = req.query;
        
        let startTime;
        
        // Check if custom date range is provided
        if (startDate && endDate) {
            startTime = new Date(startDate);
            const endTime = new Date(endDate);
            
            console.log(`📊 Custom range request: vmId=${vmId}, from=${startTime.toISOString()} to=${endTime.toISOString()}`);
            
            // Query with custom date range
            const query = `
                SELECT 
                    id,
                    vm_id as "vmId",
                    hostname,
                    timestamp,
                    cpu_usage,
                    cpu_cores,
                    memory_total,
                    memory_used,
                    memory_percent,
                    disk_total,
                    disk_used,
                    disk_percent,
                    processes,
                    services
                FROM metrics
                WHERE vm_id = $1 AND timestamp >= $2 AND timestamp <= $3
                ORDER BY timestamp DESC
                LIMIT $4;
            `;
            
            const result = await pool.query(query, [vmId, startTime, endTime, parseInt(limit)]);
            
            // Transform to match expected format
            const metrics = result.rows.map(row => ({
                vmId: row.vmId,
                hostname: row.hostname,
                timestamp: row.timestamp,
                cpu: {
                    usage: row.cpu_usage,
                    cores: row.cpu_cores
                },
                memory: {
                    total: row.memory_total,
                    used: row.memory_used,
                    percent: row.memory_percent
                },
                disk: {
                    total: row.disk_total,
                    used: row.disk_used,
                    percent: row.disk_percent
                },
                processes: row.processes,
                services: row.services
            }));
            
            console.log(`✅ Found ${metrics.length} records for custom range`);
            res.json(metrics.reverse()); // Return chronological order
            return;
        }
        
        // Standard period-based query
        console.log(`📊 Historical data request: vmId=${vmId}, period=${period}, limit=${limit}`);
        
        startTime = new Date();
        switch (period) {
            case '1h': startTime.setHours(startTime.getHours() - 1); break;
            case '6h': startTime.setHours(startTime.getHours() - 6); break;
            case '24h': startTime.setHours(startTime.getHours() - 24); break;
            case '7d': startTime.setDate(startTime.getDate() - 7); break;
            case '30d': startTime.setDate(startTime.getDate() - 30); break;
            default: startTime.setHours(startTime.getHours() - 1);
        }

        console.log(`📅 Searching for metrics after: ${startTime.toISOString()}`);

        const metrics = await Metric.find(vmId, startTime, parseInt(limit));

        console.log(`✅ Found ${metrics.length} historical records for ${vmId}`);

        res.json(metrics.reverse()); // Return chronological order
    } catch (error) {
        console.error('❌ Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// 4. Delete Old Metrics
app.delete('/api/metrics/:vmId', async (req, res) => {
    try {
        const { vmId } = req.params;
        const { period = '30d' } = req.query;
        
        let cutoffDate = new Date();
        switch (period) {
            case '1d': cutoffDate.setDate(cutoffDate.getDate() - 1); break;
            case '7d': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
            case '30d': cutoffDate.setDate(cutoffDate.getDate() - 30); break;
            default: cutoffDate.setDate(cutoffDate.getDate() - 30);
        }

        const result = await Metric.deleteMany(vmId, cutoffDate);

        res.json({ 
            success: true, 
            deletedCount: result.deletedCount,
            message: `Deleted ${result.deletedCount} records older than ${period}`
        });
    } catch (error) {
        console.error('Error deleting metrics:', error);
        res.status(500).json({ error: 'Failed to delete metrics' });
    }
});

// 5. Get Storage Statistics
app.get('/api/storage-stats', async (req, res) => {
    try {
        const stats = await Metric.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching storage stats:', error);
        res.status(500).json({ error: 'Failed to fetch storage stats' });
    }
});

// 6. Get Agent Configuration
app.get('/api/config/:vmId', (req, res) => {
    const { vmId } = req.params;
    const agent = registry[vmId];
    
    if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Return current configuration (stored in registry)
    res.json({
        vmId: agent.vmId,
        hostname: agent.hostname,
        broadcastInterval: agent.broadcastInterval || 0.5,
        storageInterval: agent.storageInterval || 5,
        lastSeen: agent.lastSeen,
        status: agent.status
    });
});

// 7. Update Agent Configuration
app.post('/api/config/:vmId', (req, res) => {
    const { vmId } = req.params;
    const { broadcastInterval, storageInterval } = req.body;
    
    if (!registry[vmId]) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Update registry with new configuration
    if (broadcastInterval !== undefined) {
        registry[vmId].broadcastInterval = broadcastInterval;
    }
    if (storageInterval !== undefined) {
        registry[vmId].storageInterval = storageInterval;
    }
    
    // Emit configuration update to all connected clients (agents will filter by vmId)
    const configUpdate = {
        vmId,
        broadcastInterval: registry[vmId].broadcastInterval,
        storageInterval: registry[vmId].storageInterval
    };
    
    io.emit('config:update', configUpdate);
    
    console.log(`Configuration updated for ${vmId}:`, configUpdate);
    
    res.json({ 
        success: true, 
        message: 'Configuration updated and broadcasted',
        config: {
            broadcastInterval: registry[vmId].broadcastInterval,
            storageInterval: registry[vmId].storageInterval
        }
    });
});

// WebSocket handling for both dashboard and agent connections
io.on('connection', (socket) => {
    console.log('New WebSocket connection:', socket.id, 'from', socket.handshake.address);
    
    // Handle agent metrics for storage
    socket.on('agent:metrics', async (data) => {
        try {
            console.log(`Received metrics from agent ${data.vmId}`);
            
            // Save to TimescaleDB
            await Metric.save(data);
            
            // Log with IST time for better debugging
            const istTime = new Date(data.timestamp).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            console.log(`✓ Stored metric for ${data.vmId} at ${istTime} IST`);
            
            // Optionally forward to dashboard clients for real-time display
            socket.broadcast.emit('metrics:update', data);
        } catch (error) {
            console.error('✗ Error saving to TimescaleDB:', error.message);
            
            // TimescaleDB specific error handling
            if (error.message.includes('authentication failed') || error.message.includes('password')) {
                console.error('💡 Hint: Check TimescaleDB username/password in .env');
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
                console.error('💡 Hint: Check if PostgreSQL/TimescaleDB is running');
            } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
                console.error('💡 Hint: Database schema not initialized properly');
            }
        }
    });
    
    // Handle dashboard-specific events
    socket.on('dashboard:subscribe', (data) => {
        console.log('Dashboard subscribed to updates');
    });
    
    socket.on('disconnect', (reason) => {
        console.log('WebSocket connection closed:', socket.id, 'reason:', reason);
    });
    
    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// 8. Get All VMs from Database (for persistent VM list)
app.get('/api/vms/all', async (req, res) => {
    try {
        // Get unique VMs from database
        const query = `
            SELECT DISTINCT ON (vm_id)
                vm_id,
                hostname,
                timestamp
            FROM metrics
            ORDER BY vm_id, timestamp DESC;
        `;
        
        const result = await pool.query(query);
        
        const dbVms = result.rows.map(row => ({
            _id: row.vm_id,
            hostname: row.hostname,
            lastSeen: row.timestamp,
            source: 'database'
        }));
        
        // Merge with registry data
        const allVms = [...dbVms];
        
        // Add registry VMs that might not be in database yet
        Object.values(registry).forEach(agent => {
            if (!allVms.find(vm => vm._id === agent.vmId)) {
                allVms.push({
                    _id: agent.vmId,
                    hostname: agent.hostname,
                    lastSeen: new Date(agent.lastSeen),
                    source: 'registry'
                });
            }
        });
        
        // Add status from registry
        const vmsWithStatus = allVms.map(vm => {
            const registryAgent = registry[vm._id];
            return {
                ...vm,
                ip: registryAgent?.ip || 'http://localhost',
                port: registryAgent?.port || 5001,
                status: registryAgent && (Date.now() - registryAgent.lastSeen) < 40000 ? 'online' : 'offline'
            };
        });
        
        res.json(vmsWithStatus);
    } catch (error) {
        console.error('Error fetching all VMs:', error);
        res.status(500).json({ error: 'Failed to fetch VMs' });
    }
});

http.listen(PORT, () => console.log(`Discovery Server running on port ${PORT}`));
