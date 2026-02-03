import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp } from 'lucide-react';
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

const HistoricalData = ({ vmId, hostname }) => {
    const [historicalData, setHistoricalData] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('1h');
    const [loading, setLoading] = useState(false);
    const [selectedDataPoint, setSelectedDataPoint] = useState(null);

    useEffect(() => {
        fetchHistoricalData();
    }, [vmId, selectedPeriod]);

    const fetchHistoricalData = async () => {
        setLoading(true);
        try {
            console.log(`Fetching historical data for ${vmId}, period: ${selectedPeriod}`);
            const response = await fetch(`http://localhost:5000/api/metrics/${vmId}?period=${selectedPeriod}&limit=200`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Received ${data.length} historical records:`, data.slice(0, 2)); // Log first 2 records
            setHistoricalData(data);
        } catch (error) {
            console.error('Error fetching historical data:', error);
            setHistoricalData([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const exportData = () => {
        const csvContent = [
            ['Timestamp (IST)', 'CPU %', 'Memory %', 'Disk %'],
            ...historicalData.map(item => [
                new Date(item.timestamp).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata'
                }),
                item.cpu.usage,
                item.memory.percent,
                item.disk?.percent || 0
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${hostname}_metrics_${selectedPeriod}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="card">
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading historical data...
                </div>
            </div>
        );
    }

    if (historicalData.length === 0) {
        return (
            <div className="card">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <TrendingUp size={20} />
                    Historical Data - {hostname}
                </h3>
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No historical data available for the selected period.
                </div>
            </div>
        );
    }

    // Prepare chart data
    const labels = historicalData.map(item => 
        new Date(item.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    );

    const chartData = {
        labels,
        datasets: [
            {
                label: 'CPU Usage (%)',
                data: historicalData.map(item => item.cpu.usage),
                borderColor: '#7aa2f7',
                backgroundColor: 'rgba(122, 162, 247, 0.1)',
                fill: false,
                tension: 0.1,
            },
            {
                label: 'Memory Usage (%)',
                data: historicalData.map(item => item.memory.percent),
                borderColor: '#bb9af7',
                backgroundColor: 'rgba(187, 154, 247, 0.1)',
                fill: false,
                tension: 0.1,
            },
            {
                label: 'Disk Usage (%)',
                data: historicalData.map(item => item.disk?.percent || 0),
                borderColor: '#9ece6a',
                backgroundColor: 'rgba(158, 206, 106, 0.1)',
                fill: false,
                tension: 0.1,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { 
                beginAtZero: true, 
                max: 100,
                grid: { color: '#414868' },
                ticks: { color: '#a9b1d6' }
            },
            x: {
                grid: { color: '#414868' },
                ticks: { 
                    color: '#a9b1d6',
                    maxTicksLimit: 8,
                    maxRotation: 45
                }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#a9b1d6' }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        },
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const dataIndex = elements[0].index;
                setSelectedDataPoint(historicalData[dataIndex]);
            }
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <TrendingUp size={20} />
                    Historical Data - {hostname}
                </h3>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select 
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        style={{ 
                            padding: '0.5rem', 
                            borderRadius: '4px', 
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="1h">Last Hour</option>
                        <option value="6h">Last 6 Hours</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    
                    <button 
                        className="btn"
                        onClick={exportData}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            backgroundColor: 'var(--accent)',
                            border: 'none',
                            color: 'white'
                        }}
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                </div>
            </div>

            <div style={{ height: '400px', marginBottom: '1rem' }}>
                <Line data={chartData} options={chartOptions} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: 'rgba(122, 162, 247, 0.1)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Avg CPU</div>
                    <div style={{ fontWeight: 'bold', color: '#7aa2f7' }}>
                        {(historicalData.reduce((sum, item) => sum + item.cpu.usage, 0) / historicalData.length).toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: 'rgba(187, 154, 247, 0.1)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Avg Memory</div>
                    <div style={{ fontWeight: 'bold', color: '#bb9af7' }}>
                        {(historicalData.reduce((sum, item) => sum + item.memory.percent, 0) / historicalData.length).toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: 'rgba(158, 206, 106, 0.1)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Data Points</div>
                    <div style={{ fontWeight: 'bold', color: '#9ece6a' }}>
                        {historicalData.length}
                    </div>
                </div>
            </div>

            {/* Data Point Detail Modal */}
            {selectedDataPoint && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '2rem',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Detailed Metrics</h3>
                            <button
                                onClick={() => setSelectedDataPoint(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                Timestamp
                            </div>
                            <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                                {new Date(selectedDataPoint.timestamp).toLocaleString('en-IN', {
                                    timeZone: 'Asia/Kolkata'
                                })}
                            </div>
                        </div>

                        {/* CPU Details */}
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(122, 162, 247, 0.1)', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', color: '#7aa2f7' }}>CPU</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overall Usage</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>{selectedDataPoint.cpu.usage.toFixed(1)}%</div>
                                </div>
                            </div>
                            
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Per-Core Usage ({selectedDataPoint.cpu.cores.length} cores)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
                                    {selectedDataPoint.cpu.cores.map((coreUsage, idx) => (
                                        <div key={idx} style={{
                                            padding: '0.5rem',
                                            backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                            borderRadius: '4px',
                                            textAlign: 'center',
                                            fontSize: '0.875rem'
                                        }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Core {idx}</div>
                                            <div style={{ fontWeight: 'bold', color: coreUsage > 50 ? '#f7768e' : '#9ece6a' }}>
                                                {coreUsage.toFixed(1)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Memory Details */}
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(187, 154, 247, 0.1)', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', color: '#bb9af7' }}>Memory</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total</div>
                                    <div style={{ fontWeight: 'bold' }}>{(selectedDataPoint.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Used</div>
                                    <div style={{ fontWeight: 'bold' }}>{(selectedDataPoint.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Percent</div>
                                    <div style={{ fontWeight: 'bold' }}>{selectedDataPoint.memory.percent.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Disk Details */}
                        {selectedDataPoint.disk && (
                            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(158, 206, 106, 0.1)', borderRadius: '8px' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', color: '#9ece6a' }}>Disk</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total</div>
                                        <div style={{ fontWeight: 'bold' }}>{(selectedDataPoint.disk.total / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Used</div>
                                        <div style={{ fontWeight: 'bold' }}>{(selectedDataPoint.disk.used / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Percent</div>
                                        <div style={{ fontWeight: 'bold' }}>{selectedDataPoint.disk.percent.toFixed(1)}%</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Services Status */}
                        {selectedDataPoint.services && Object.keys(selectedDataPoint.services).length > 0 && (
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(224, 175, 104, 0.1)', borderRadius: '8px' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', color: '#e0af68' }}>Services</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {Object.entries(selectedDataPoint.services).map(([service, status]) => (
                                        <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{service}</span>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                backgroundColor: status === 'running' ? 'rgba(158, 206, 106, 0.2)' : 'rgba(247, 118, 142, 0.2)',
                                                color: status === 'running' ? '#9ece6a' : '#f7768e'
                                            }}>
                                                {status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricalData;