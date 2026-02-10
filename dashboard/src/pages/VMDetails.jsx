import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Cpu, Activity, Database, TrendingUp } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import io from 'socket.io-client';
import DataManagement from '../components/DataManagement';
import HistoricalData from '../components/HistoricalData';
import ConnectionStatus from '../components/ConnectionStatus';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const VMDetails = () => {
    const { vmId } = useParams();
    const location = useLocation();
    const [agentUrl, setAgentUrl] = useState(location.state?.agentUrl || null);
    const [vmInfo, setVmInfo] = useState(null); // Store VM info from discovery

    const [metrics, setMetrics] = useState([]);
    const [latest, setLatest] = useState(null);
    const [activeTab, setActiveTab] = useState('realtime');
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const socketRef = useRef(null);

    // 1. Fetch VM info from Discovery Server
    useEffect(() => {
        const fetchDiscovery = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/vms');
                const agents = await res.json();
                const target = agents.find(a => a._id === vmId);
                if (target) {
                    setVmInfo(target);
                    if (!agentUrl) {
                        setAgentUrl(`${target.ip}:${target.port}`);
                    }
                } else {
                    console.error("Agent not found in registry");
                }
            } catch (e) {
                console.error("Failed to discover agent", e);
            }
        };
        
        fetchDiscovery();
        // Poll for status updates
        const interval = setInterval(fetchDiscovery, 5000);
        return () => clearInterval(interval);
    }, [vmId, agentUrl]);

    // 2. Connect when agentUrl is available and VM is online
    useEffect(() => {
        if (!agentUrl || vmInfo?.status === 'offline') return;

        console.log(`VMDetails connecting to ${agentUrl}`);
        const socket = io(agentUrl);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to agent');
            setConnectionStatus('connected');
        });

        socket.on('metrics:update', (data) => {
            setLatest(data);
            setMetrics(prev => {
                const newMetrics = [...prev, data];
                if (newMetrics.length > 30) newMetrics.shift(); // Keep last 30 points
                return newMetrics;
            });
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from agent');
            setConnectionStatus('disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            setConnectionStatus('error');
        });

        return () => {
            socket.disconnect();
        };
    }, [agentUrl, vmInfo?.status]);

    if (!agentUrl || !vmInfo) return <div className="container">Loading VM information...</div>;

    const isOffline = vmInfo.status === 'offline';
    const displayHostname = latest?.hostname || vmInfo.hostname || vmId;

    // Chart Data with IST timestamps
    const labels = metrics.map(m => 
        new Date(m.timestamp).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        })
    );

    const cpuData = {
        labels,
        datasets: [{
            label: 'CPU Usage (%)',
            data: metrics.map(m => m.cpu.usage),
            borderColor: '#7aa2f7',
            backgroundColor: 'rgba(122, 162, 247, 0.2)',
            fill: true,
            tension: 0.2, // Sharper lines for realtime feel
        }],
    };

    const memData = {
        labels,
        datasets: [{
            label: 'Memory Usage (%)',
            data: metrics.map(m => m.memory.percent),
            borderColor: '#bb9af7',
            backgroundColor: 'rgba(187, 154, 247, 0.2)',
            fill: true,
            tension: 0.2,
        }],
    };

    const chartOptions = {
        responsive: true,
        animation: { duration: 0 }, // Disable animation for instant updates
        scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#414868' }, ticks: { color: '#a9b1d6' } },
            x: {
                display: true,
                grid: { display: false }, // Keep grid hidden for clean look
                ticks: {
                    color: '#a9b1d6',
                    maxTicksLimit: 4, // Show approx 3-4 timestamps
                    maxRotation: 0,
                    autoSkip: true
                }
            }
        },
        plugins: { legend: { display: false } }
    };

    return (
        <div>
            <Link to="/" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', backgroundColor: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                <ArrowLeft size={16} /> Back to Dashboard
            </Link>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1>{displayHostname}</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>ID: {vmId}</p>
                </div>
                <ConnectionStatus 
                    agentUrl={agentUrl} 
                    vmId={vmId}
                    agentStatus={isOffline ? 'offline' : connectionStatus}
                />
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
                <button 
                    className={`btn ${activeTab === 'realtime' ? 'active' : ''}`}
                    onClick={() => setActiveTab('realtime')}
                    style={{ 
                        backgroundColor: activeTab === 'realtime' ? 'var(--accent)' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'realtime' ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: '0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'white'
                    }}
                >
                    <Activity size={16} />
                    Real-time
                </button>
                <button 
                    className={`btn ${activeTab === 'historical' ? 'active' : ''}`}
                    onClick={() => setActiveTab('historical')}
                    style={{ 
                        backgroundColor: activeTab === 'historical' ? 'var(--accent)' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'historical' ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: '0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'white'
                    }}
                >
                    <TrendingUp size={16} />
                    Historical
                </button>
                <button 
                    className={`btn ${activeTab === 'management' ? 'active' : ''}`}
                    onClick={() => setActiveTab('management')}
                    style={{ 
                        backgroundColor: activeTab === 'management' ? 'var(--accent)' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'management' ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: '0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'white'
                    }}
                >
                    <Database size={16} />
                    Data Management
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'realtime' && (
                <>
                    {isOffline ? (
                        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Activity size={64} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
                            <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Agent Offline</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                                This VM is currently offline. Real-time monitoring is unavailable.
                            </p>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                                You can still view historical data and manage stored metrics using the tabs above.
                            </p>
                        </div>
                    ) : !latest ? (
                        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Activity size={64} style={{ color: 'var(--accent)', margin: '0 auto 1rem', animation: 'spin 2s linear infinite' }} />
                            <h2 style={{ marginBottom: '1rem' }}>Connecting to Agent...</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Establishing connection to receive real-time metrics.
                            </p>
                        </div>
                    ) : (
                        <>
                    {/* System Stats Overview */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                        gap: '1rem', 
                        marginBottom: '2rem' 
                    }}>
                        {/* CPU Stats Card */}
                        <div className="card" style={{ backgroundColor: 'rgba(122, 162, 247, 0.1)', border: '1px solid rgba(122, 162, 247, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Cpu size={24} style={{ color: '#7aa2f7' }} />
                                <h3 style={{ margin: 0, color: '#7aa2f7' }}>CPU</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Cores</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{latest.cpu.cores.length}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Usage</div>
                                    <div style={{ 
                                        fontSize: '1.5rem', 
                                        fontWeight: 'bold',
                                        color: latest.cpu.usage > 80 ? 'var(--danger)' : latest.cpu.usage > 60 ? '#ffc107' : 'var(--success)'
                                    }}>
                                        {latest.cpu.usage.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Memory Stats Card */}
                        <div className="card" style={{ backgroundColor: 'rgba(187, 154, 247, 0.1)', border: '1px solid rgba(187, 154, 247, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Activity size={24} style={{ color: '#bb9af7' }} />
                                <h3 style={{ margin: 0, color: '#bb9af7' }}>Memory</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                        {(latest.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Used</div>
                                    <div style={{ 
                                        fontSize: '1.5rem', 
                                        fontWeight: 'bold',
                                        color: latest.memory.percent > 80 ? 'var(--danger)' : latest.memory.percent > 60 ? '#ffc107' : 'var(--success)'
                                    }}>
                                        {(latest.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Disk Stats Card */}
                        <div className="card" style={{ backgroundColor: 'rgba(158, 206, 106, 0.1)', border: '1px solid rgba(158, 206, 106, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Database size={24} style={{ color: '#9ece6a' }} />
                                <h3 style={{ margin: 0, color: '#9ece6a' }}>Disk</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                        {latest.disk ? (latest.disk.total / 1024 / 1024 / 1024).toFixed(1) : '0'} GB
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Used</div>
                                    <div style={{ 
                                        fontSize: '1.5rem', 
                                        fontWeight: 'bold',
                                        color: latest.disk?.percent > 80 ? 'var(--danger)' : latest.disk?.percent > 60 ? '#ffc107' : 'var(--success)'
                                    }}>
                                        {latest.disk ? (latest.disk.used / 1024 / 1024 / 1024).toFixed(1) : '0'} GB
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Cpu size={20} /> Real-time CPU Usage ({latest.cpu.usage}%)
                            </h3>
                            <Line data={cpuData} options={chartOptions} />
                        </div>
                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Activity size={20} /> Real-time Memory Usage ({latest.memory.percent}%)
                            </h3>
                            <Line data={memData} options={chartOptions} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                        <div className="card">
                            <h3>Top Processes</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '0.5rem' }}>PID</th>
                                        <th style={{ padding: '0.5rem' }}>Name</th>
                                        <th style={{ padding: '0.5rem' }}>CPU %</th>
                                        <th style={{ padding: '0.5rem' }}>Mem %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {latest.processes.map((proc, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{proc.pid}</td>
                                            <td style={{ padding: '0.5rem' }}>{proc.name}</td>
                                            <td style={{ padding: '0.5rem', color: proc.cpu_percent > 50 ? 'var(--danger)' : 'inherit' }}>{proc.cpu_percent?.toFixed(1)}</td>
                                            <td style={{ padding: '0.5rem' }}>{proc.memory_percent?.toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="card">
                            <h3>Services Status</h3>
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {latest.services && Object.entries(latest.services).map(([service, statusData]) => {
                                    // Handle both old format (string) and new format (object)
                                    const state = typeof statusData === 'string' ? statusData : statusData.state;
                                    const checks = typeof statusData === 'object' ? statusData.checks : null;
                                    
                                    // Map states to badge styles
                                    const getBadgeClass = (state) => {
                                        switch(state) {
                                            case 'healthy': return 'badge-success';
                                            case 'degraded': return 'badge-warning';
                                            case 'down': return 'badge-danger';
                                            case 'unknown': return 'badge-secondary';
                                            case 'running': return 'badge-success';
                                            case 'stopped': return 'badge-danger';
                                            default: return 'badge-warning';
                                        }
                                    };
                                    
                                    // Get emoji for state
                                    const getStateEmoji = (state) => {
                                        switch(state) {
                                            case 'healthy': return '🟢';
                                            case 'degraded': return '🟡';
                                            case 'down': return '🔴';
                                            case 'unknown': return '⚪';
                                            default: return '';
                                        }
                                    };
                                    
                                    return (
                                        <div key={service} style={{ padding: '0.5rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: '600' }}>{service}</span>
                                                <span className={`badge ${getBadgeClass(state)}`}>
                                                    {getStateEmoji(state)} {state}
                                                </span>
                                            </div>
                                            {checks && (
                                                <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    {Object.entries(checks).map(([checkName, checkResult]) => (
                                                        <div key={checkName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                            <span>{checkResult.passed ? '✅' : '❌'}</span>
                                                            <span style={{ textTransform: 'capitalize' }}>{checkName}:</span>
                                                            <span style={{ color: checkResult.passed ? '#9ece6a' : '#f7768e' }}>
                                                                {checkResult.message}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {(!latest.services || Object.keys(latest.services).length === 0) && (
                                    <div style={{ color: 'var(--text-secondary)' }}>No services monitored.</div>
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </>
            )}

            {activeTab === 'historical' && (
                <HistoricalData vmId={vmId} hostname={displayHostname} />
            )}

            {activeTab === 'management' && (
                <DataManagement vmId={vmId} hostname={displayHostname} />
            )}
        </div>
    );
};

export default VMDetails;
