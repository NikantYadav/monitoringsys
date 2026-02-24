import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Server, Activity } from 'lucide-react';
import config from '../config';

const ConnectionStatus = ({ agentUrl, vmId, agentStatus }) => {
    const [serverStatus, setServerStatus] = useState('disconnected');

    useEffect(() => {
        // Check server connection
        const checkServerConnection = async () => {
            try {
                const response = await fetch(`${config.SERVER_URL}/api/vms`);
                setServerStatus(response.ok ? 'connected' : 'error');
            } catch (error) {
                setServerStatus('error');
            }
        };

        checkServerConnection();
        const serverInterval = setInterval(checkServerConnection, 10000); // Check every 10s

        return () => clearInterval(serverInterval);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'var(--success)';
            case 'error': return 'var(--danger)';
            default: return 'var(--warning)';
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            alignItems: 'center',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={14} style={{ color: getStatusColor(agentStatus) }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Real-time: 
                </span>
                <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    color: getStatusColor(agentStatus)
                }}>
                    {agentStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
                </span>
            </div>
            
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Server size={14} style={{ color: getStatusColor(serverStatus) }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Storage: 
                </span>
                <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    color: getStatusColor(serverStatus)
                }}>
                    {serverStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>
            
        </div>
    );
};

export default ConnectionStatus;