# VM Monitoring System

A real-time infrastructure monitoring solution with live metrics visualization, intelligent alerting, service health monitoring, and historical data management. Supports both TimescaleDB and InfluxDB for flexible time-series storage.

## Overview

Monitor multiple virtual machines in real-time with a modern dashboard, automatic service health detection, and intelligent threshold-based alerting. The system uses a dual-path architecture for optimal performance: direct WebSocket connections for real-time metrics and persistent storage for historical analysis.

## Architecture

**Dual-Path Design for Optimal Performance:**

- **Agent** (Python): Collects system metrics and sends via dual WebSocket paths:
  - **Real-time path**: Direct WebSocket to Dashboard (low latency, ~0.5s updates)
  - **Storage path**: WebSocket to Server for database persistence (~5s updates)
- **Server** (Node.js): Discovery service, data persistence, alert engine, and management APIs
- **Dashboard** (React): Real-time interface with direct agent connection + server APIs for historical data

```
┌─────────┐    Real-time (WebSocket)     ┌───────────┐
│  Agent  │ ──────────────────────────→ │ Dashboard │
│         │                             │           │
│         │    Storage (WebSocket)      │           │
│         │ ──────────────────────────→ │  Server   │ ←─── APIs, Config
└─────────┘                             │           │      Historical Data
                                        │           │      Alerts
                                        └───────────┘
                                              ↓
                                        ┌───────────┐
                                        │ Database  │
                                        │(TimescaleDB│
                                        │or InfluxDB)│
                                        └───────────┘
```

This architecture provides:
- **Lowest latency** for real-time monitoring (direct agent-to-dashboard connection)
- **Efficient storage** via WebSocket (no HTTP overhead)
- **Centralized management** for configuration, alerts, and historical data
- **Flexible database support**: TimescaleDB (260% faster inserts, 54x faster queries) or InfluxDB
- **Automatic data retention** and compression for long-term storage

## Quick Start

### Prerequisites
- Python 3.x with psutil, requests, aiohttp, python-socketio
- Node.js 16+ with npm
- PostgreSQL 12+ with TimescaleDB extension **OR** InfluxDB Core 3
- Modern web browser

### 1. Start Database

**Option A: TimescaleDB (Recommended for SQL queries)**
```bash
docker run -d --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=monitoring_sys \
  timescale/timescaledb:latest-pg16
```

**Option B: InfluxDB Core 3 (Recommended for high-volume metrics)**
```bash
docker run -d --name influxdb \
  -p 8181:8181 \
  influxdata/influxdb3-core:latest
```
Note: You'll need to create a token after starting InfluxDB Core 3.

### 2. Configure Database Connection
Edit `server/.env`:

**For TimescaleDB:**
```env
PORT=5000

# Database Selection
DATABASE_TYPE=timescaledb

# TimescaleDB Connection (PostgreSQL)
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=monitoring_sys

# Email Notifications (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=monitoring@yourdomain.com
EMAIL_FROM_NAME=System Monitor
ADMIN_EMAILS=admin@example.com
DASHBOARD_URL=http://localhost:5173
```

**For InfluxDB:**
```env
PORT=5000

# Database Selection
DATABASE_TYPE=influxdb

# InfluxDB Core 3 Connection
INFLUXDB_HOST=http://localhost:8181
INFLUXDB_TOKEN=your_influxdb_token
INFLUXDB_DATABASE=monitoring

# Email Notifications (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=monitoring@yourdomain.com
EMAIL_FROM_NAME=System Monitor
ADMIN_EMAILS=admin@example.com
DASHBOARD_URL=http://localhost:5173
```

### 3. Start the Discovery Server
```bash
cd server
npm install
npm start
```
Server runs on `http://localhost:5000` and auto-initializes the database

### 4. Configure the Monitoring Agent
Edit `agent/config.json`:
```json
{
  "server_url": "http://localhost:5000",
  "vm_id": "vm-001-local",
  "hostname": "ubuntu-server",
  "broadcast_interval": 0.5,
  "storage_interval": 5,
  "services_to_monitor": ["nginx", "mysql", "docker", "ssh"]
}
```

### 5. Start the Monitoring Agent
```bash
cd agent
pip install -r requirements.txt
python agent.py
```
Agent runs on port `5001` and auto-registers with the server

### 6. Start the Dashboard
```bash
cd dashboard
npm install
npm run dev
```
Dashboard available at `http://localhost:5173`

### Supported Services
- Web servers: nginx, apache, httpd
- Databases: mysql, postgresql, mongodb, redis
- Search: elasticsearch
- PHP: php-fpm, php8.2-fpm
- Node.js: nodejs
- Containers: docker
- SSH: ssh

## Features

### Real-time Monitoring
- **Live Metrics Dashboard**: Real-time CPU, memory, and disk usage charts with direct agent connection
- **Multi-VM Support**: Auto-discovery and management of multiple agents
- **Process Monitoring**: Top 5 processes by CPU usage with detailed metrics
- **Service Status**: Monitor system services with robust multi-signal health detection
- **Auto-Discovery**: Agents automatically register with the server
- **Dual-Path Connection**: Direct WebSocket for real-time + HTTP for storage

### Intelligent Alerting System
- **Multi-Metric Alerts**: Monitor CPU, memory, disk, swap, load average, inodes, and I/O wait
- **Threshold-Based Alerts**: Warning and critical thresholds with configurable durations
- **Service Monitoring**: Alerts when services stop or become degraded
- **Real-time Notifications**: Browser notifications for critical alerts
- **Email Notifications**: SMTP-based email alerts with HTML templates
- **Alert Management**: Acknowledge and resolve alerts from the dashboard
- **Alert History**: View all alerts with filtering by state and severity
- **Configurable Rules**: Customize thresholds and durations for each metric
- **Auto-Resolution**: Alerts automatically resolve when metrics return to normal
- **Service Alert Batching**: First alert immediate, subsequent grouped in 10-minute windows
- **Daily Summaries**: Optional email digest of alert activity

#### Default Alert Thresholds

| Metric | Warning | Critical | Duration |
|--------|---------|----------|----------|
| CPU Usage | > 80% | > 90% | 5 minutes |
| Load Average | > Cores × 1.5 | > Cores × 2.0 | 5 minutes |
| Memory Usage | > 80% | > 90-95% | Immediate |
| Swap Usage | > 60% | > 90% | Immediate |
| Disk Space | > 85% | > 95% | Immediate |
| Inodes Usage | > 85% | > 95% | Immediate |
| Disk I/O Wait | > 20% | > 40% | Immediate |

### Service Health Checking
- **Multi-Signal Detection**: HTTP/HTTPS, TCP, Unix socket, systemd, process detection
- **Supported Services**: nginx, apache, mysql, postgresql, mongodb, redis, elasticsearch, php-fpm, nodejs, docker, ssh, and more
- **Health States**: healthy, degraded, down, unknown
- **Detailed Diagnostics**: View specific health check results and failure reasons

### Historical Data & Analysis
- **Data Persistence**: Metrics saved to database (TimescaleDB or InfluxDB) at configurable intervals
- **Historical Charts**: View trends over 1h, 6h, 24h, 7d, or 30d periods
- **Custom Date Ranges**: Select any custom date range for historical analysis
- **Data Export**: Export historical data as CSV files
- **Statistics**: Average CPU/memory usage and data point counts
- **Automatic Compression**: Older data automatically compressed to save space (TimescaleDB)
- **30-Day Retention**: Configurable data retention policy (TimescaleDB)

### Data Management
- **Storage Statistics**: View total records and data ranges per VM
- **Data Cleanup**: Delete old data (>1 day, >1 week, >1 month)
- **Auto-Retention**: Data automatically expires after 30 days (TimescaleDB only)
- **Storage Monitoring**: Track database usage and optimize storage
- **Hypertable Optimization**: Automatic time-based partitioning for fast queries (TimescaleDB only)

### Configuration Management
- **Real-time Intervals**: Configure dashboard update frequency (0.1s - 10s)
- **Storage Intervals**: Configure database persistence frequency (1s - 300s)
- **Live Updates**: Configuration changes applied immediately via WebSocket
- **Preset Configurations**: Quick settings for different use cases
- **Dual Frequency**: Separate intervals for display vs storage optimization
- **Alert Rules**: Configure thresholds and durations for all alert types

## Data Storage Recommendations

- **5 seconds**: Recommended for real-time monitoring (current default)
- **30 seconds**: Good balance for most use cases
- **1-2 minutes**: Sufficient for long-term trend analysis

The system automatically manages data retention and provides tools for manual cleanup.

## Requirements

- Python 3.x with psutil, requests, aiohttp, python-socketio
- Node.js 16+ with express, pg, socket.io, @influxdata/influxdb3-client
- **Database (choose one):**
  - PostgreSQL 12+ with TimescaleDB extension (recommended for SQL queries)
  - InfluxDB Core 3 (recommended for high-volume metrics)
- Modern web browser

## Project Structure

```
├── agent/                          # Python monitoring agent
│   ├── agent.py                   # Main agent with metrics collection
│   ├── config.json                # Agent configuration
│   └── requirements.txt           # Python dependencies
│
├── server/                         # Node.js backend server
│   ├── index.js                   # Main server with discovery & APIs
│   ├── alertEngine.js             # Alert evaluation and triggering
│   ├── emailNotifier.js           # Email notification handler
│   ├── db.js                      # TimescaleDB initialization
│   ├── influxdb.js                # InfluxDB Core 3 client
│   ├── dbAdapter.js               # Database abstraction layer
│   ├── models/                    # Data models (TimescaleDB)
│   │   ├── Alert.js              # Alert model
│   │   └── Metric.js             # Metric model
│   └── package.json              # Node.js dependencies
│
├── dashboard/                      # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Main VM overview page
│   │   │   └── VMDetails.jsx      # Individual VM details
│   │   ├── components/
│   │   │   ├── HistoricalData.jsx # Historical metrics viewer
│   │   │   ├── AlertsPanel.jsx    # Alert display and management
│   │   │   ├── AlertRulesConfig.jsx # Alert threshold configuration
│   │   │   ├── DataManagement.jsx # Data cleanup and export
│   │   │   ├── AgentConfiguration.jsx # Agent settings
│   │   │   └── ConnectionStatus.jsx # Connection indicator
│   │   ├── App.jsx                # Main app component
│   │   └── config.js              # Frontend configuration
│   └── package.json              # React dependencies
│
└── README.md                       # This file
```

## API Endpoints

### Discovery & Registration
- `POST /api/register` - Agent registration/heartbeat
- `GET /api/vms` - List online agents
- `GET /api/vms/all` - List all VMs (online + offline from database)

### Metrics
- `GET /api/metrics/:vmId` - Historical metrics with period/date range filtering
- `DELETE /api/metrics/:vmId` - Delete old metrics
- `GET /api/storage-stats` - Database storage statistics

### Configuration
- `GET /api/config/:vmId` - Get agent configuration
- `POST /api/config/:vmId` - Update agent configuration

### Alerts
- `GET /api/alerts/:vmId` - Get alerts with filtering
- `GET /api/alerts/:vmId/stats` - Alert statistics
- `DELETE /api/alerts/:vmId/old` - Delete old alerts
- `GET /api/alert-rules` - Get alert rules
- `POST /api/alert-rules` - Update alert rules

## Data Flow

```
Agent (Python)
  ├─ Collects metrics every 0.5s
  ├─ Path 1: Broadcasts to Dashboard (WebSocket) → Real-time display
  └─ Path 2: Sends to Server (WebSocket) every 5s
       ├─ Server stores in Database (TimescaleDB or InfluxDB)
       ├─ Alert Engine evaluates metrics
       ├─ Triggers alerts if thresholds exceeded
       └─ Email Notifier sends notifications

Dashboard (React)
  ├─ Fetches VM list from Server API
  ├─ Connects directly to Agent WebSocket
  ├─ Displays real-time metrics
  ├─ Fetches historical data from Server API
  └─ Shows alerts and allows configuration
```

## Technology Stack

**Backend:**
- Node.js with Express.js
- Socket.io for WebSocket communication
- PostgreSQL with TimescaleDB extension OR InfluxDB Core 3
- Nodemailer for email notifications

**Frontend:**
- React 19 with React Router
- Chart.js for metrics visualization
- Socket.io-client for real-time updates
- Lucide React for icons

**Agent:**
- Python 3.x
- psutil for system metrics
- aiohttp for async HTTP
- python-socketio for WebSocket

**Database:**
- TimescaleDB: Time-series optimized PostgreSQL
  - Automatic hypertable creation and partitioning
  - 30-day retention policy with compression
  - 260% faster inserts, 54x faster queries vs standard PostgreSQL
- InfluxDB Core 3: Purpose-built time-series database
  - High-volume metrics ingestion
  - Efficient compression and storage
  - SQL query support

## Service Status Detection

The agent uses multiple methods for robust service monitoring:
1. **systemctl** (modern Linux systems)
2. **service** command (older systems)  
3. **Process detection** (fallback method)

Supports status: `running`, `stopped`, `not_found`, `timeout`, `error`, `unknown`

