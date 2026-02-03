require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Metric = require('./models/Metric');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas with retry logic
const connectToMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas');
        console.log('Database: monitoring_sys');
    } catch (err) {
        console.error('✗ MongoDB Atlas connection error:', err.message);
        
        // Specific error handling
        if (err.message.includes('bad auth') || err.message.includes('authentication failed')) {
            console.error('💡 Authentication Issue - Please check:');
            console.error('   1. Username and password are correct');
            console.error('   2. User has proper database permissions');
            console.error('   3. Password doesn\'t contain special characters (or is URL encoded)');
            console.error('   4. Using database user credentials (not Atlas account credentials)');
        } else if (err.message.includes('network') || err.message.includes('ENOTFOUND')) {
            console.error('💡 Network Issue - Please check:');
            console.error('   1. Internet connection');
            console.error('   2. IP address is whitelisted in Atlas Network Access');
            console.error('   3. Cluster URL is correct');
        }
        
        console.error('Retrying connection in 5 seconds...');
        setTimeout(connectToMongoDB, 5000);
    }
};

connectToMongoDB();

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('✓ Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('✗ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠ Mongoose disconnected from MongoDB Atlas');
});

// Handle process termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB Atlas connection closed through app termination');
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
        const { period = '1h', limit = 100 } = req.query;
        
        console.log(`📊 Historical data request: vmId=${vmId}, period=${period}, limit=${limit}`);
        
        let startTime = new Date();
        switch (period) {
            case '1h': startTime.setHours(startTime.getHours() - 1); break;
            case '6h': startTime.setHours(startTime.getHours() - 6); break;
            case '24h': startTime.setHours(startTime.getHours() - 24); break;
            case '7d': startTime.setDate(startTime.getDate() - 7); break;
            case '30d': startTime.setDate(startTime.getDate() - 30); break;
            default: startTime.setHours(startTime.getHours() - 1);
        }

        console.log(`📅 Searching for metrics after: ${startTime.toISOString()}`);

        const metrics = await Metric.find({
            vmId,
            timestamp: { $gte: startTime }
        })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .select('timestamp cpu memory disk services');

        console.log(`✅ Found ${metrics.length} historical records for ${vmId}`);
        
        if (metrics.length > 0) {
            console.log(`📈 Sample record:`, {
                timestamp: metrics[0].timestamp,
                cpu: metrics[0].cpu?.usage,
                memory: metrics[0].memory?.percent
            });
        }

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

        const result = await Metric.deleteMany({
            vmId,
            timestamp: { $lt: cutoffDate }
        });

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
        const stats = await Metric.aggregate([
            {
                $group: {
                    _id: '$vmId',
                    totalRecords: { $sum: 1 },
                    oldestRecord: { $min: '$timestamp' },
                    newestRecord: { $max: '$timestamp' },
                    hostname: { $first: '$hostname' }
                }
            }
        ]);

        const totalRecords = await Metric.countDocuments();
        
        res.json({
            totalRecords,
            vmStats: stats
        });
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
            
            // Check if MongoDB is connected
            if (mongoose.connection.readyState !== 1) {
                console.error('✗ MongoDB Atlas not connected, skipping storage');
                return;
            }
            
            // Save to MongoDB Atlas
            const metricData = {
                ...data,
                timestamp: new Date(data.timestamp) // Convert milliseconds to Date object
            };
            
            const metric = new Metric(metricData);
            await metric.save();
            
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
            console.error('✗ Error saving to MongoDB Atlas:', error.message);
            
            // MongoDB Atlas specific error handling
            if (error.message.includes('authentication failed')) {
                console.error('💡 Hint: Check MongoDB Atlas username/password');
            } else if (error.message.includes('network') || error.message.includes('timeout')) {
                console.error('💡 Hint: Check internet connection to MongoDB Atlas');
            } else if (error.message.includes('validation')) {
                console.error('💡 Hint: Data validation error - check metric data format');
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

http.listen(PORT, () => console.log(`Discovery Server running on port ${PORT}`));
