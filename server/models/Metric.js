const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
    vmId: { type: String, required: true, index: true },
    hostname: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    cpu: {
        usage: { type: Number, required: true }, // Overall percentage
        cores: [Number] // Per core usage
    },
    memory: {
        total: { type: Number, required: true },
        used: { type: Number, required: true },
        percent: { type: Number, required: true }
    },
    disk: {
        total: { type: Number },
        used: { type: Number },
        percent: { type: Number }
    },
    processes: [{
        pid: Number,
        name: String,
        cpu_percent: Number,
        memory_percent: Number
    }],
    services: {
        type: Map,
        of: String // e.g., "nginx": "running", "mysql": "stopped"
    }
}, { timestamps: true });

// TTL Index to expire old metrics after 30 days (optional)
MetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Metric', MetricSchema);
