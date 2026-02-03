import asyncio
import psutil
import socketio
from aiohttp import web
import socket
import os
import json
import requests
import subprocess
import logging
import time
from datetime import datetime, timezone, timedelta

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Configuration
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')
with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

# Discovery Server URL
DISCOVERY_URL = config.get('server_url', 'http://localhost:5000').replace('/api/metrics', '')
AGENT_PORT = 5001
VM_ID = config.get('vm_id')
HOSTNAME = socket.gethostname()
BROADCAST_INTERVAL = config.get('broadcast_interval', 0.5)  # Real-time updates
STORAGE_INTERVAL = config.get('storage_interval', 5)  # Database storage
SERVICES_MONITOR = config.get('services_to_monitor', [])

# Counters for interval management
broadcast_counter = 0
storage_counter = 0

# Create Socket.IO Server (Async) for direct dashboard connections
sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)

# Create Socket.IO Client for server connection (storage path)
server_sio = socketio.AsyncClient()
server_connected = False

def get_cpu_metrics():
    return {
        'usage': psutil.cpu_percent(interval=None),
        'cores': psutil.cpu_percent(interval=None, percpu=True)
    }

def get_memory_metrics():
    mem = psutil.virtual_memory()
    return {
        'total': mem.total,
        'used': mem.used,
        'percent': mem.percent
    }

def get_disk_metrics():
    disk = psutil.disk_usage('/')
    return {
        'total': disk.total,
        'used': disk.used,
        'percent': disk.percent
    }

def get_top_processes(n=5):
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
        try:
            processes.append(proc.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    processes.sort(key=lambda p: p['cpu_percent'], reverse=True)
    return processes[:n]

def get_service_status():
    """Get status of monitored services using multiple methods for better compatibility"""
    status_map = {}
    
    for service in SERVICES_MONITOR:
        try:
            # Method 1: Try systemctl (most common on modern Linux)
            result = subprocess.run(
                ['systemctl', 'is-active', service], 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            
            if result.returncode == 0:
                status_map[service] = "running"
            else:
                # Check if service exists but is inactive
                exists_result = subprocess.run(
                    ['systemctl', 'list-unit-files', f'{service}.service'], 
                    capture_output=True, 
                    text=True, 
                    timeout=5
                )
                if service in exists_result.stdout:
                    status_map[service] = "stopped"
                else:
                    status_map[service] = "not_found"
                    
        except subprocess.TimeoutExpired:
            status_map[service] = "timeout"
        except FileNotFoundError:
            # systemctl not available, try alternative methods
            try:
                # Method 2: Try service command (older systems)
                result = subprocess.run(
                    ['service', service, 'status'], 
                    capture_output=True, 
                    text=True, 
                    timeout=5
                )
                status_map[service] = "running" if result.returncode == 0 else "stopped"
            except (FileNotFoundError, subprocess.TimeoutExpired):
                # Method 3: Check if process is running by name
                try:
                    for proc in psutil.process_iter(['name']):
                        if proc.info['name'] and service.lower() in proc.info['name'].lower():
                            status_map[service] = "running"
                            break
                    else:
                        status_map[service] = "stopped"
                except Exception:
                    status_map[service] = "unknown"
        except Exception as e:
            logger.warning(f"Error checking service {service}: {e}")
            status_map[service] = "error"
    
    return status_map

def get_ist_timestamp():
    """Get current timestamp in IST (Indian Standard Time)"""
    # IST is UTC+5:30
    ist_offset = timedelta(hours=5, minutes=30)
    ist_timezone = timezone(ist_offset)
    
    # Get current time in IST
    ist_time = datetime.now(ist_timezone)
    
    # Return as milliseconds timestamp
    return int(ist_time.timestamp() * 1000)

def collect_metrics():
    return {
        'vmId': VM_ID,
        'hostname': HOSTNAME,
        'cpu': get_cpu_metrics(),
        'memory': get_memory_metrics(),
        'disk': get_disk_metrics(),
        'processes': get_top_processes(),
        'services': get_service_status(),
        'timestamp': get_ist_timestamp()
    }

async def registration_loop():
    """ Periodically register with discovery server """
    while True:
        try:
            payload = {
                'vmId': VM_ID,
                'hostname': HOSTNAME,
                'ip': 'http://localhost', 
                'port': AGENT_PORT,
                'broadcastInterval': BROADCAST_INTERVAL,
                'storageInterval': STORAGE_INTERVAL
            }
            
            # Register with discovery server
            response = requests.post(f"{DISCOVERY_URL}/api/register", json=payload, timeout=5)
            if response.status_code == 200:
                logger.debug("Successfully registered with discovery server")
            else:
                logger.warning(f"Registration failed with status: {response.status_code}")
            
            # Try to reconnect to server if disconnected
            if not server_connected:
                logger.info("Server connection lost, attempting to reconnect...")
                await connect_to_server()
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Registration request failed: {e}")
        except Exception as e:
            logger.error(f"Registration failed: {e}")
            
        await asyncio.sleep(30)  # Register every 30s

async def connect_to_server():
    """Connect to server for storage path"""
    global server_connected
    
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            server_url = "http://localhost:5000"
            logger.info(f"Attempting to connect to server at {server_url} (attempt {attempt + 1}/{max_retries})")
            
            await server_sio.connect(server_url)
            server_connected = True
            logger.info(f"Successfully connected to server for storage")
            return
            
        except Exception as e:
            logger.error(f"Connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error("Max connection attempts reached. Will retry during registration loop.")
                server_connected = False

@server_sio.event
async def connect():
    global server_connected
    server_connected = True
    logger.info("✓ Connected to server for storage")

@server_sio.event
async def disconnect():
    global server_connected
    server_connected = False
    logger.warning("✗ Disconnected from server")

@server_sio.event
async def connect_error(data):
    global server_connected
    server_connected = False
    logger.error(f"✗ Server connection error: {data}")

async def send_to_server_for_storage(data):
    """Send metrics to server for database storage (WebSocket)"""
    global server_connected
    
    if not server_connected:
        logger.debug("Not connected to server, skipping storage")
        return
        
    try:
        await server_sio.emit('agent:metrics', data)
        logger.debug(f"✓ Sent data to server for storage")
    except Exception as e:
        logger.error(f"✗ Error sending to server: {e}")
        server_connected = False

async def metric_broadcast_loop():
    global broadcast_counter, storage_counter
    
    # Prime CPU
    psutil.cpu_percent(interval=None)
    
    # Calculate how many broadcast cycles per storage cycle
    storage_cycles = int(STORAGE_INTERVAL / BROADCAST_INTERVAL)
    
    while True:
        try:
            # Collect metrics
            data = collect_metrics()
            
            # Path 1: Always broadcast to dashboard clients (direct, low latency)
            await sio.emit('metrics:update', data)
            
            # Path 2: Send to server for storage (only when storage interval is reached)
            if broadcast_counter % storage_cycles == 0:
                # Send to server for database storage via WebSocket
                await send_to_server_for_storage(data)
                storage_counter += 1
                logger.debug(f"Sent data to server for storage (cycle {storage_counter})")
            
            broadcast_counter += 1
            
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
        
        await asyncio.sleep(BROADCAST_INTERVAL)

async def start_background_tasks(app):
    # Wait a bit for the agent server to be ready
    await asyncio.sleep(2)
    
    # Connect to server for storage path
    await connect_to_server()
    
    # Start background tasks
    sio.start_background_task(registration_loop)
    sio.start_background_task(metric_broadcast_loop)

# Socket.IO event handlers for configuration updates
@sio.event
async def config_update(sid, data):
    """Handle configuration updates from server"""
    global BROADCAST_INTERVAL, STORAGE_INTERVAL, broadcast_counter, storage_counter
    
    if data.get('vmId') == VM_ID:
        logger.info(f"Received configuration update: {data}")
        
        if 'broadcastInterval' in data:
            BROADCAST_INTERVAL = data['broadcastInterval']
        if 'storageInterval' in data:
            STORAGE_INTERVAL = data['storageInterval']
            
        # Reset counters to apply new intervals immediately
        broadcast_counter = 0
        storage_counter = 0
        
        logger.info(f"Updated intervals - Broadcast: {BROADCAST_INTERVAL}s, Storage: {STORAGE_INTERVAL}s")

# Server socket.io event handlers
@server_sio.event
async def config_update(data):
    """Handle configuration updates from server via storage connection"""
    global BROADCAST_INTERVAL, STORAGE_INTERVAL, broadcast_counter, storage_counter
    
    if data.get('vmId') == VM_ID:
        logger.info(f"Received configuration update from server: {data}")
        
        if 'broadcastInterval' in data:
            BROADCAST_INTERVAL = data['broadcastInterval']
        if 'storageInterval' in data:
            STORAGE_INTERVAL = data['storageInterval']
            
        # Reset counters to apply new intervals immediately
        broadcast_counter = 0
        storage_counter = 0
        
        logger.info(f"Updated intervals - Broadcast: {BROADCAST_INTERVAL}s, Storage: {STORAGE_INTERVAL}s")

app.on_startup.append(start_background_tasks)

if __name__ == "__main__":
    print(f"Starting Agent Server (Aiohttp) on port {AGENT_PORT}")
    web.run_app(app, port=AGENT_PORT)
