import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Clock, Database } from 'lucide-react';
import appConfig from '../config';

const AgentConfiguration = ({ vmId, hostname }) => {
    const [config, setConfig] = useState({
        broadcastInterval: 0.5,
        storageInterval: 5
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchConfiguration();
    }, [vmId]);

    const fetchConfiguration = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${appConfig.SERVER_URL}/api/config/${vmId}`);
            if (response.ok) {
                const data = await response.json();
                setConfig({
                    broadcastInterval: data.broadcastInterval || 0.5,
                    storageInterval: data.storageInterval || 5
                });
            }
        } catch (error) {
            console.error('Error fetching configuration:', error);
            setMessage('✗ Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const saveConfiguration = async () => {
        setSaving(true);
        setMessage('');

        try {
            const response = await fetch(`${appConfig.SERVER_URL}/api/config/${vmId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            
            if (result.success) {
                setMessage('✓ Configuration updated successfully');
            } else {
                setMessage('✗ Failed to update configuration');
            }
        } catch (error) {
            setMessage(`✗ Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (field, value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) return;
        
        setConfig(prev => ({
            ...prev,
            [field]: numValue
        }));
    };

    const calculateDataPoints = () => {
        const pointsPerMinute = 60 / config.storageInterval;
        const pointsPerHour = pointsPerMinute * 60;
        const pointsPerDay = pointsPerHour * 24;
        
        return {
            perMinute: Math.round(pointsPerMinute),
            perHour: Math.round(pointsPerHour),
            perDay: Math.round(pointsPerDay)
        };
    };

    const dataPoints = calculateDataPoints();

    return (
        <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Settings size={20} />
                Agent Configuration - {hostname}
            </h3>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading configuration...
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                        {/* Real-time Broadcast Interval */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <Clock size={16} style={{ color: 'var(--accent)' }} />
                                <h4 style={{ margin: 0 }}>Real-time Updates</h4>
                            </div>
                            
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Broadcast Interval (seconds)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    max="10"
                                    value={config.broadcastInterval}
                                    onChange={(e) => handleInputChange('broadcastInterval', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border)',
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(122, 162, 247, 0.1)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    Dashboard Update Frequency
                                </div>
                                <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                                    Every {config.broadcastInterval}s ({Math.round(60 / config.broadcastInterval)} updates/min)
                                </div>
                            </div>
                        </div>

                        {/* Database Storage Interval */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <Database size={16} style={{ color: 'var(--success)' }} />
                                <h4 style={{ margin: 0 }}>Database Storage</h4>
                            </div>
                            
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Storage Interval (seconds)
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    max="300"
                                    value={config.storageInterval}
                                    onChange={(e) => handleInputChange('storageInterval', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border)',
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(158, 206, 106, 0.1)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    Data Points Stored
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                                    {dataPoints.perMinute}/min • {dataPoints.perHour}/hour • {dataPoints.perDay}/day
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preset Configurations */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h4 style={{ marginBottom: '1rem' }}>Quick Presets</h4>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn"
                                onClick={() => setConfig({ broadcastInterval: 0.5, storageInterval: 5 })}
                                style={{ backgroundColor: 'var(--accent)', border: 'none', fontSize: '0.875rem', color: 'white' }}
                            >
                                High Frequency (0.5s / 5s)
                            </button>
                            <button
                                className="btn"
                                onClick={() => setConfig({ broadcastInterval: 1, storageInterval: 30 })}
                                style={{ backgroundColor: 'var(--success)', border: 'none', fontSize: '0.875rem', color: 'white' }}
                            >
                                Balanced (1s / 30s)
                            </button>
                            <button
                                className="btn"
                                onClick={() => setConfig({ broadcastInterval: 2, storageInterval: 60 })}
                                style={{ backgroundColor: 'var(--warning)', border: 'none', fontSize: '0.875rem', color: 'white' }}
                            >
                                Low Frequency (2s / 60s)
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            className="btn"
                            onClick={saveConfiguration}
                            disabled={saving}
                            style={{
                                backgroundColor: 'var(--success)',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'white'
                            }}
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                        
                        <button
                            className="btn"
                            onClick={fetchConfiguration}
                            disabled={loading}
                            style={{
                                backgroundColor: 'transparent',
                                border: '1px solid var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'var(--accent)'
                            }}
                        >
                            <RefreshCw size={16} />
                            Refresh
                        </button>
                    </div>

                    {message && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            backgroundColor: message.startsWith('✓') ? 'rgba(158, 206, 106, 0.2)' : 'rgba(247, 118, 142, 0.2)',
                            color: message.startsWith('✓') ? 'var(--success)' : 'var(--danger)'
                        }}>
                            {message}
                        </div>
                    )}

                    {/* Information Panel */}
                    <div style={{ 
                        marginTop: '2rem', 
                        padding: '1rem', 
                        backgroundColor: 'rgba(224, 175, 104, 0.1)', 
                        borderRadius: '6px', 
                        border: '1px solid rgba(224, 175, 104, 0.3)' 
                    }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--warning)' }}>Configuration Notes:</strong><br />
                            • <strong>Broadcast Interval:</strong> How often the dashboard receives updates (affects real-time responsiveness)<br />
                            • <strong>Storage Interval:</strong> How often data is saved to MongoDB (affects storage usage)<br />
                            • Lower intervals = more responsive but higher resource usage<br />
                            • Changes take effect immediately after saving
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AgentConfiguration;