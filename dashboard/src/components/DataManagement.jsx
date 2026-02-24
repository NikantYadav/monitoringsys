import React, { useState, useEffect } from 'react';
import { Database, Trash2, BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
import config from '../config';

const DataManagement = ({ vmId, hostname }) => {
    const [storageStats, setStorageStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshInterval = 30; // Fixed 30 seconds

    useEffect(() => {
        fetchStorageStats();
    }, []);

    // Auto-refresh effect - refresh every 1 minute
    useEffect(() => {
        const interval = setInterval(() => {
            fetchStorageStats(true); // Background refresh
        }, 60 * 1000); // 60 seconds = 1 minute

        return () => clearInterval(interval);
    }, []);

    const fetchStorageStats = async (isBackgroundRefresh = false) => {
        if (isBackgroundRefresh) {
            setIsRefreshing(true);
        }
        
        try {
            const response = await fetch(`${config.SERVER_URL}/api/storage-stats`);
            const data = await response.json();
            console.log('Storage stats received:', data); // Debug log
            setStorageStats(data);
        } catch (error) {
            console.error('Error fetching storage stats:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const deleteOldData = async (period) => {
        if (!confirm(`Are you sure you want to delete data older than ${period}? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${config.SERVER_URL}/api/metrics/${vmId}?period=${period}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                setMessage(`✓ ${result.message}`);
                fetchStorageStats(); // Refresh stats
            } else {
                setMessage(`✗ Failed to delete data`);
            }
        } catch (error) {
            setMessage(`✗ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const currentVmStats = storageStats?.vmStats?.find(vm => vm._id === vmId);

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Database size={20} />
                    Data Management - {hostname}
                </h3>

                {/* Refresh indicator */}
                {isRefreshing && (
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
            </div>

            {storageStats && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {/* Total Records Card */}
                        <div style={{ padding: '1rem', backgroundColor: 'rgba(122, 162, 247, 0.1)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Records</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                {storageStats.totalRecords ? storageStats.totalRecords.toLocaleString() : '0'}
                            </div>
                        </div>
                        
                        {/* VM-specific stats */}
                        {currentVmStats && (
                            <>
                                <div style={{ padding: '1rem', backgroundColor: 'rgba(187, 154, 247, 0.1)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>VM Records</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                        {currentVmStats.totalRecords ? currentVmStats.totalRecords.toLocaleString() : '0'}
                                    </div>
                                </div>
                                
                                {currentVmStats.oldestRecord && currentVmStats.newestRecord && (
                                    <div style={{ padding: '1rem', backgroundColor: 'rgba(158, 206, 106, 0.1)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Data Range</div>
                                        <div style={{ fontSize: '0.75rem' }}>
                                            {formatDate(currentVmStats.oldestRecord)} <br />
                                            to {formatDate(currentVmStats.newestRecord)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trash2 size={16} />
                    Delete Old Data
                </h4>
                
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button 
                        className="btn"
                        onClick={() => deleteOldData('1d')}
                        disabled={loading}
                        style={{ backgroundColor: 'var(--danger)', border: 'none', color: 'white' }}
                    >
                        Delete &gt; 1 Day
                    </button>
                    <button 
                        className="btn"
                        onClick={() => deleteOldData('7d')}
                        disabled={loading}
                        style={{ backgroundColor: 'var(--danger)', border: 'none', color: 'white' }}
                    >
                        Delete &gt; 1 Week
                    </button>
                    <button 
                        className="btn"
                        onClick={() => deleteOldData('30d')}
                        disabled={loading}
                        style={{ backgroundColor: 'var(--danger)', border: 'none', color: 'white' }}
                    >
                        Delete &gt; 1 Month
                    </button>
                </div>
            </div>

            {message && (
                <div style={{ 
                    padding: '0.75rem', 
                    borderRadius: '6px', 
                    backgroundColor: message.startsWith('✓') ? 'rgba(158, 206, 106, 0.2)' : 'rgba(247, 118, 142, 0.2)',
                    color: message.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                    marginBottom: '1rem'
                }}>
                    {message}
                </div>
            )}

            <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <AlertCircle size={16} style={{ color: '#ffc107' }} />
                    <strong style={{ color: '#ffc107' }}>Data Storage Info</strong>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    • Metrics are collected every 5 seconds by default<br />
                    • Data is automatically expired after 30 days (configurable)<br />
                    • Use the delete options above to manage storage manually<br />
                    • Historical data is used for trend analysis and reporting
                </div>
            </div>
        </div>
    );
};

export default DataManagement;