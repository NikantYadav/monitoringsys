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

    const [metrics, setMetrics] = useState([]);
    const [latest, setLatest] = useState(null);
    const [activeTab, setActiveTab] = useState('realtime');
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const socketRef = useRef(null);

    // 1. If agentUrl is missing, fetch it from Discovery Server
    useEffect(() => {
        if (agentUrl) return;

        const fetchDiscovery = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/vms');
                const agents = await res.json();
                const target = agents.find(a => a._id === vmId);
                if (target) {
                    setAgentUrl(`${target.ip}:${target.port}`);
                } else {
                    console.error("Agent not found in registry");
                }
            } catch (e) {
                console.error("Failed to discover agent", e);
            }
        };
        fetchDiscovery();
    }, [vmId, agentUrl]);

    // 2. Connect when agentUrl is available
    useEffect(() => {
        if (!agentUrl) return;

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
    }, [agentUrl]);

    if (!agentUrl) return <div className="container">Error: Unknown Agent URL</div>;
    if (!latest) return <div className="container">Connecting to Agent...</div>;

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
                    <h1>{latest.hostname}</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>ID: {latest.vmId}</p>
                </div>
                <ConnectionStatus 
                    agentUrl={agentUrl} 
                    vmId={vmId}
                    agentStatus={connectionStatus}
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
                                {latest.services && Object.entries(latest.services).map(([service, status]) => (
                                    <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                        <span style={{ fontWeight: '600' }}>{service}</span>
                                        <span className={`badge badge-${status === 'running' ? 'success' : status === 'stopped' ? 'danger' : 'warning'}`}>
                                            {status}
                                        </span>
                                    </div>
                                ))}
                                {(!latest.services || Object.keys(latest.services).length === 0) && (
                                    <div style={{ color: 'var(--text-secondary)' }}>No services monitored.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'historical' && (
                <HistoricalData vmId={vmId} hostname={latest.hostname} />
            )}

            {activeTab === 'management' && (
                <DataManagement vmId={vmId} hostname={latest.hostname} />
            )}
        </div>
    );
};

export default VMDetails;
