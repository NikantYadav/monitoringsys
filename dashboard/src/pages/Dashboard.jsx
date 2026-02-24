import React, { useEffect, useState, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { Server, Activity } from 'lucide-react';
import io from 'socket.io-client';
import config from '../config';

// Memoized VM Card component to prevent unnecessary re-renders
const VMCard = memo(({ vm }) => {
    return (
        <Link to={`/vm/${vm._id}`} state={{ agentUrl: vm.agentUrl }} key={vm._id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(122, 162, 247, 0.1)', color: 'var(--accent)' }}>
                    <Server size={24} />
                </div>
                <div>
                    <h3 style={{ margin: 0 }}>{vm.hostname}</h3>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{vm._id}</span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <span className={`badge badge-${vm.status === 'online' ? 'success' : 'danger'}`}>
                        {vm.status || 'Unknown'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU</div>
                    <div style={{ fontWeight: 'bold', color: vm.cpu?.usage > 80 ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {vm.cpu?.usage ? `${vm.cpu.usage.toFixed(1)}%` : 'N/A'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Memory</div>
                    <div style={{ fontWeight: 'bold' }}>
                        {vm.memory?.percent ? `${vm.memory.percent.toFixed(1)}%` : 'N/A'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</div>
                    <div style={{ fontSize: '0.75rem', color: vm.status === 'online' ? 'var(--success)' : 'var(--danger)' }}>
                        {vm.status === 'online' ? 'Live' : 'Offline'}
                    </div>
                </div>
            </div>

            {/* Detailed System Stats - Only show if online and has data */}
            {vm.status === 'online' && vm.cpu && vm.memory && (
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
                fontSize: '0.75rem'
            }}>
                {/* CPU Stats */}
                <div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: '600' }}>CPU</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Cores:</span>
                        <span>{vm.cpu?.cores?.length || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Usage:</span>
                        <span style={{ color: vm.cpu?.usage > 80 ? 'var(--danger)' : 'var(--success)' }}>
                            {vm.cpu?.usage?.toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Memory Stats */}
                <div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: '600' }}>Memory</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
                        <span>{(vm.memory?.total / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Used:</span>
                        <span style={{ color: vm.memory?.percent > 80 ? 'var(--danger)' : 'var(--success)' }}>
                            {(vm.memory?.used / 1024 / 1024 / 1024).toFixed(1)} GB
                        </span>
                    </div>
                </div>

                {/* Disk Stats */}
                <div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: '600' }}>Disk</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
                        <span>{vm.disk ? (vm.disk.total / 1024 / 1024 / 1024).toFixed(1) : '0'} GB</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Used:</span>
                        <span style={{ color: vm.disk?.percent > 80 ? 'var(--danger)' : 'var(--success)' }}>
                            {vm.disk ? (vm.disk.used / 1024 / 1024 / 1024).toFixed(1) : '0'} GB
                        </span>
                    </div>
                </div>
            </div>
            )}
            
            {/* Offline message */}
            {vm.status === 'offline' && (
            <div style={{ 
                padding: '0.75rem',
                backgroundColor: 'rgba(247, 118, 142, 0.1)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                textAlign: 'center'
            }}>
                Agent offline - Click to view historical data
            </div>
            )}
        </Link>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function - only re-render if these values change
    const prev = prevProps.vm;
    const next = nextProps.vm;
    
    return (
        prev._id === next._id &&
        prev.hostname === next.hostname &&
        prev.status === next.status &&
        prev.cpu?.usage === next.cpu?.usage &&
        prev.memory?.percent === next.memory?.percent &&
        prev.disk?.percent === next.disk?.percent
    );
});

const Dashboard = () => {
    const [vms, setVms] = useState({}); // Map: vmId -> vmData
    const socketsRef = useRef({}); // Map: vmId -> socket instance
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        // 1. Initial fetch of all VMs
        const fetchAllVMs = async () => {
            try {
                const res = await fetch(`${config.SERVER_URL}/api/vms/all`);
                const allVms = await res.json();

                // Initialize VM state with database info
                const vmsMap = {};
                allVms.forEach(vm => {
                    vmsMap[vm._id] = {
                        _id: vm._id,
                        hostname: vm.hostname,
                        lastSeen: vm.lastSeen,
                        status: vm.status,
                        agentUrl: `${vm.ip}:${vm.port}`,
                        cpu: null,
                        memory: null,
                        disk: null
                    };

                    // Connect to online agents
                    if (vm.status === 'online' && !socketsRef.current[vm._id]) {
                        connectToAgent(vm);
                    }
                });
                
                setVms(vmsMap);
                setIsInitialLoad(false);
            } catch (err) {
                console.error("Failed to fetch VMs", err);
                setIsInitialLoad(false);
            }
        };

        fetchAllVMs();
    }, []);

    // 2. Periodic status check (less frequent, only updates status)
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${config.SERVER_URL}/api/vms/all`);
                const allVms = await res.json();

                setVms(prev => {
                    const updated = { ...prev };
                    
                    allVms.forEach(vm => {
                        if (updated[vm._id]) {
                            // Only update status if changed
                            if (updated[vm._id].status !== vm.status) {
                                console.log(`VM ${vm._id} status changed: ${updated[vm._id].status} -> ${vm.status}`);
                                updated[vm._id] = {
                                    ...updated[vm._id],
                                    status: vm.status
                                };
                                
                                // Handle connection changes
                                if (vm.status === 'online' && !socketsRef.current[vm._id]) {
                                    connectToAgent(vm);
                                } else if (vm.status === 'offline' && socketsRef.current[vm._id]) {
                                    socketsRef.current[vm._id].disconnect();
                                    delete socketsRef.current[vm._id];
                                }
                            }
                        } else {
                            // New VM discovered
                            console.log(`New VM discovered: ${vm._id}`);
                            updated[vm._id] = {
                                _id: vm._id,
                                hostname: vm.hostname,
                                lastSeen: vm.lastSeen,
                                status: vm.status,
                                agentUrl: `${vm.ip}:${vm.port}`,
                                cpu: null,
                                memory: null,
                                disk: null
                            };
                            
                            if (vm.status === 'online') {
                                connectToAgent(vm);
                            }
                        }
                    });
                    
                    return updated;
                });
            } catch (err) {
                console.error("Status check failed", err);
            }
        };

        const interval = setInterval(checkStatus, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    const connectToAgent = (vm) => {
        // Only connect to online agents
        if (vm.status !== 'online') return;

        // Construct Direct URL (e.g., http://localhost:5001)
        const agentUrl = `${vm.ip}:${vm.port}`;
        console.log(`Connecting directly to agent ${vm._id} at ${agentUrl}`);

        const socket = io(agentUrl);
        socketsRef.current[vm._id] = socket;

        socket.on('metrics:update', (data) => {
            setVms(prev => ({
                ...prev,
                [data.vmId]: {
                    ...prev[data.vmId],
                    _id: data.vmId,
                    hostname: data.hostname,
                    lastSeen: data.timestamp,
                    cpu: data.cpu,
                    memory: data.memory,
                    disk: data.disk,
                    status: 'online',
                    agentUrl // Store for details page link
                }
            }));
        });

        socket.on('disconnect', () => {
            console.log(`Lost connection to ${vm._id}`);
            setVms(prev => {
                // Only update if status actually changed
                if (prev[vm._id]?.status === 'offline') return prev;
                
                return {
                    ...prev,
                    [vm._id]: { ...prev[vm._id], status: 'offline' }
                };
            });
        });

        socket.on('connect_error', () => {
            console.log(`Connection error for ${vm._id}`);
            setVms(prev => {
                // Only update if status actually changed
                if (prev[vm._id]?.status === 'offline') return prev;
                
                return {
                    ...prev,
                    [vm._id]: { ...prev[vm._id], status: 'offline' }
                };
            });
        });
    };

    // Cleanup sockets on unmount
    useEffect(() => {
        return () => {
            Object.values(socketsRef.current).forEach(s => s.disconnect());
        };
    }, []);

    const vmList = Object.values(vms);
    const onlineCount = vmList.filter(vm => vm.status === 'online').length;

    if (isInitialLoad) return (
        <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
            <Activity size={48} style={{ color: 'var(--accent)', margin: '0 auto 1rem', animation: 'spin 2s linear infinite' }} />
            <h2>Loading Infrastructure...</h2>
            <p>Discovering agents and establishing connections...</p>
        </div>
    );

    if (vmList.length === 0) return (
        <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
            <h2>No Agents Found</h2>
            <p>Please ensure Agent is running and registered with Server.</p>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Infrastructure Overview</h1>
                <div>
                    <span className="badge badge-success">{onlineCount} Online</span>
                    <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>{vmList.length - onlineCount} Offline</span>
                    <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total: {vmList.length}</span>
                </div>
            </div>

            <div className="grid-vms">
                {vmList.map((vm) => (
                    <VMCard key={vm._id} vm={vm} />
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
