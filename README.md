# VM Monitoring System

A real-time infrastructure monitoring solution with live metrics visualization and historical data management, powered by TimescaleDB for optimal time-series performance.

## Architecture

**Dual-Path Design for Optimal Performance:**

- **Agent** (Python): Collects system metrics and sends via dual WebSocket paths:
  - **Real-time path**: Direct WebSocket to Dashboard (low latency)
  - **Storage path**: WebSocket to Server for TimescaleDB persistence
- **Server** (Node.js): Discovery service, data persistence, and management APIs
- **Dashboard** (React): Real-time interface with direct agent connection + server APIs

```
┌─────────┐    Real-time (WebSocket)     ┌───────────┐
│  Agent  │ ──────────────────────────→ │ Dashboard │
│         │                             │           │
│         │    Storage (WebSocket)      │           │
│         │ ──────────────────────────→ │  Server   │ ←─── APIs, Config
└─────────┘                             │           │      Historical Data
                                        └───────────┘
                                              ↓
                                        ┌───────────┐
                                        │TimescaleDB│
                                        └───────────┘
```

This architecture provides:
- **Lowest latency** for real-time monitoring (direct connection)
- **Efficient storage** via WebSocket (no HTTP overhead)
- **Centralized management** for configuration and historical data
- **260% faster inserts** and **54x faster queries** with TimescaleDB

## Why TimescaleDB?

We migrated from MongoDB to TimescaleDB for superior time-series performance:
- **Automatic time-based partitioning** (hypertables)
- **Built-in data compression** to reduce storage costs
- **SQL compatibility** - use standard PostgreSQL queries
- **Automatic data retention policies**
- **Optimized for time-series workloads**

[Learn more about the migration](server/TIMESCALEDB_SETUP.md)

## Quick Start

### 1. Start TimescaleDB
```bash
# Using Docker (recommended)
docker run -d --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=monitoring_sys \
  timescale/timescaledb:latest-pg16
```

### 2. Configure Database Connection
Edit `server/.env`:
```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=monitoring_sys
```

### 3. Start the Discovery Server
```bash
cd server
npm install
npm start
```
Server runs on `http://localhost:5000` and auto-initializes the database

### 4. Start the Monitoring Agent
```bash
cd agent
pip install -r requirements.txt
python agent.py
```
Agent runs on port `5001` and auto-registers with the server

### 5. Start the Dashboard
```bash
cd dashboard
npm install
npm run dev
```
Dashboard available at `http://localhost:5173`

## Configuration

Edit `agent/config.json` to customize:
- VM ID and hostname
- Metrics collection interval (default: 5 seconds)
- Services to monitor (nginx, mysql, mongodb, docker, ssh)

## Features

### Real-time Monitoring
- **Live Metrics**: Real-time CPU, memory, and disk usage charts (direct agent connection)
- **Process Monitoring**: Top 5 processes by CPU usage
- **Service Status**: Monitor system services with proper status detection
- **Auto-Discovery**: Agents automatically register with the server
- **Dual-Path Connection**: Direct WebSocket for real-time + HTTP for storage

### Historical Data
- **Data Persistence**: Metrics saved to TimescaleDB at configurable intervals
- **Historical Charts**: View trends over 1h, 6h, 24h, 7d, or 30d periods
- **Data Export**: Export historical data as CSV files
- **Statistics**: Average CPU/memory usage and data point counts
- **Automatic Compression**: Older data automatically compressed to save space

### Data Management
- **Storage Statistics**: View total records and data ranges per VM
- **Data Cleanup**: Delete old data (>1 day, >1 week, >1 month)
- **Auto-Retention**: Data automatically expires after 30 days (configurable)
- **Storage Monitoring**: Track database usage and optimize storage
- **Hypertable Optimization**: Automatic time-based partitioning for fast queries

### Configuration Management
- **Real-time Intervals**: Configure dashboard update frequency (0.1s - 10s)
- **Storage Intervals**: Configure database persistence frequency (1s - 300s)
- **Live Updates**: Configuration changes applied immediately via WebSocket
- **Preset Configurations**: Quick settings for different use cases
- **Dual Frequency**: Separate intervals for display vs storage optimization

## Data Storage Recommendations

- **5 seconds**: Recommended for real-time monitoring (current default)
- **30 seconds**: Good balance for most use cases
- **1-2 minutes**: Sufficient for long-term trend analysis

The system automatically manages data retention and provides tools for manual cleanup.

## Requirements

- Python 3.x with psutil, requests, flask, socketio
- Node.js 16+ with express, pg, socket.io
- PostgreSQL 12+ with TimescaleDB extension
- Modern web browser

## Service Status Detection

The agent uses multiple methods for robust service monitoring:
1. **systemctl** (modern Linux systems)
2. **service** command (older systems)  
3. **Process detection** (fallback method)

Supports status: `running`, `stopped`, `not_found`, `timeout`, `error`, `unknown`

## Migration from MongoDB

If you have existing MongoDB data, see [Migration Guide](server/TIMESCALEDB_SETUP.md) for instructions on migrating to TimescaleDB.