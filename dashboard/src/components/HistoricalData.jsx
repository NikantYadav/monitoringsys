import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, RefreshCw } from 'lucide-react';
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
    const [loading, setLoading] = useState(true); // Only true on initial load
    const [isRefreshing, setIsRefreshing] = useState(false); // Separate state for refresh
    const [selectedDataPoint, setSelectedDataPoint] = useState(null);
    const [showCustomRange, setShowCustomRange] = useState(false);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [customRangeLabel, setCustomRangeLabel] = useState(''); // Store custom range label
    const refreshInterval = 30; // Fixed 30 seconds

    useEffect(() => {
        if (selectedPeriod !== 'custom') {
            fetchHistoricalData(null, null, true); // Initial load
        }
    }, [vmId, selectedPeriod]);

    // Auto-refresh effect (always enabled except for custom range)
    useEffect(() => {
        if (selectedPeriod === 'custom') return;

        const interval = setInterval(() => {
            fetchHistoricalData(null, null, false); // Background refresh
        }, refreshInterval * 1000);

        return () => clearInterval(interval);
    }, [vmId, selectedPeriod]);

    const fetchHistoricalData = async (startDate = null, endDate = null, isInitialLoad = false) => {
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setIsRefreshing(true);
        }
        
        try {
            let url;
            if (startDate && endDate) {
                console.log(`Fetching custom range data for ${vmId}:`);
                console.log(`  Start: ${startDate}`);
                console.log(`  End: ${endDate}`);
                url = `http://localhost:5000/api/metrics/${vmId}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=1000`;
                console.log(`  URL: ${url}`);
            } else {
                console.log(`Fetching historical data for ${vmId}, period: ${selectedPeriod}`);
                url = `http://localhost:5000/api/metrics/${vmId}?period=${selectedPeriod}&limit=200`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Received ${data.length} historical records`);
            
            if (data.length > 0) {
                console.log(`First record timestamp: ${data[0].timestamp}`);
                console.log(`Last record timestamp: ${data[data.length - 1].timestamp}`);
            }
            
            setHistoricalData(data);
        } catch (error) {
            console.error('Error fetching historical data:', error);
            if (isInitialLoad) {
                setHistoricalData([]);
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleCustomRangeApply = () => {
        if (customStartDate && customEndDate) {
            const start = new Date(customStartDate).toISOString();
            const end = new Date(customEndDate).toISOString();
            
            // Validate date range
            if (new Date(start) > new Date(end)) {
                alert('Start date must be before end date');
                return;
            }
            
            // Create label for display
            const startLabel = new Date(customStartDate).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const endLabel = new Date(customEndDate).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            setCustomRangeLabel(`${startLabel} - ${endLabel}`);
            
            console.log('Applying custom range:', { start, end });
            fetchHistoricalData(start, end, true);
            setShowCustomRange(false);
        } else {
            alert('Please select both start and end dates');
        }
    };

    const handlePeriodChange = (period) => {
        setSelectedPeriod(period);
        if (period === 'custom') {
            setShowCustomRange(true);
            // Set default dates (last 24 hours)
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            setCustomEndDate(formatDateTimeLocal(end));
            setCustomStartDate(formatDateTimeLocal(start));
            // Clear historical data until custom range is applied
            setHistoricalData([]);
            setCustomRangeLabel('');
        } else {
            setShowCustomRange(false);
            setCustomStartDate('');
            setCustomEndDate('');
            setCustomRangeLabel('');
        }
    };

    // Helper to format date for datetime-local input
    const formatDateTimeLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
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

    if (historicalData.length === 0 && selectedPeriod !== 'custom') {
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
        animation: {
            duration: 750, // Smooth animation
            easing: 'easeInOutQuart'
        },
        transitions: {
            active: {
                animation: {
                    duration: 0 // No animation on hover
                }
            }
        },
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <TrendingUp size={20} />
                        Historical Data - {hostname}
                    </h3>
                    {selectedPeriod === 'custom' && customRangeLabel && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={12} />
                            {customRangeLabel}
                        </div>
                    )}
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select 
                        value={selectedPeriod} 
                        onChange={(e) => handlePeriodChange(e.target.value)}
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
                        <option value="custom">Custom Range</option>
                    </select>
                    
                    {/* Refresh indicator */}
                    {isRefreshing && selectedPeriod !== 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <RefreshCw 
                                size={14} 
                                style={{ 
                                    color: 'var(--success)',
                                    animation: 'spin 1s linear infinite'
                                }} 
                            />
                            Updating...
                        </div>
                    )}
                    
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

            {/* Custom Date Range Modal */}
            {showCustomRange && (
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
                        minWidth: '400px',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={20} />
                                Select Custom Date Range
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCustomRange(false);
                                    setSelectedPeriod('1h');
                                }}
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
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Start Date & Time
                            </label>
                            <input
                                type="datetime-local"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                End Date & Time
                            </label>
                            <input
                                type="datetime-local"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowCustomRange(false);
                                    setSelectedPeriod('1h');
                                }}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCustomRangeApply}
                                disabled={!customStartDate || !customEndDate}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: customStartDate && customEndDate ? 'var(--accent)' : 'var(--border)',
                                    color: 'white',
                                    cursor: customStartDate && customEndDate ? 'pointer' : 'not-allowed',
                                    fontWeight: 'bold'
                                }}
                            >
                                Apply Range
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {Object.entries(selectedDataPoint.services).map(([service, statusData]) => {
                                        // Handle both old format (string) and new format (object)
                                        const state = typeof statusData === 'string' ? statusData : statusData.state;
                                        const checks = typeof statusData === 'object' ? statusData.checks : null;
                                        
                                        // Get color based on state
                                        const getStateColor = (state) => {
                                            switch(state) {
                                                case 'healthy': return { bg: 'rgba(158, 206, 106, 0.2)', text: '#9ece6a' };
                                                case 'degraded': return { bg: 'rgba(224, 175, 104, 0.2)', text: '#e0af68' };
                                                case 'down': return { bg: 'rgba(247, 118, 142, 0.2)', text: '#f7768e' };
                                                case 'unknown': return { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8' };
                                                case 'running': return { bg: 'rgba(158, 206, 106, 0.2)', text: '#9ece6a' };
                                                case 'stopped': return { bg: 'rgba(247, 118, 142, 0.2)', text: '#f7768e' };
                                                default: return { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8' };
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
                                        
                                        const colors = getStateColor(state);
                                        
                                        return (
                                            <div key={service} style={{ padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: '600' }}>{service}</span>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        backgroundColor: colors.bg,
                                                        color: colors.text
                                                    }}>
                                                        {getStateEmoji(state)} {state}
                                                    </span>
                                                </div>
                                                {checks && (
                                                    <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
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