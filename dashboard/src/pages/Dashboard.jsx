import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Server, Activity } from 'lucide-react';
import io from 'socket.io-client';

const Dashboard = () => {
    const [vms, setVms] = useState({}); // Map: vmId -> vmData
    const socketsRef = useRef({}); // Map: vmId -> socket instance

    useEffect(() => {
        // 1. Fetch Registered Agents from Discovery Server
        const fetchAgents = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/vms');
                const agents = await res.json();

                agents.forEach(agent => {
                    // If new agent or not connected
                    if (!socketsRef.current[agent._id]) {
                        connectToAgent(agent);
                    }
                });
            } catch (err) {
                console.error("Discovery failed", err);
            }
        };

        fetchAgents();
        const interval = setInterval(fetchAgents, 5000); // Poll discovery every 5s for new VMs
        return () => clearInterval(interval);
    }, []);

    const connectToAgent = (agent) => {
        // Construct Direct URL (e.g., http://localhost:5001)
        const agentUrl = `${agent.ip}:${agent.port}`;
        console.log(`Connecting directly to agent ${agent._id} at ${agentUrl}`);

        const socket = io(agentUrl);
        socketsRef.current[agent._id] = socket;

        socket.on('metrics:update', (data) => {
            setVms(prev => ({
                ...prev,
                [data.vmId]: {
                    _id: data.vmId,
                    hostname: data.hostname,
                    lastSeen: data.timestamp,
                    cpu: data.cpu,
                    memory: data.memory,
                    status: 'online',
                    agentUrl // Store for details page link
                }
            }));
        });

        socket.on('disconnect', () => {
            console.log(`Lost connection to ${agent._id}`);
            setVms(prev => ({
                ...prev,
                [agent._id]: { ...prev[agent._id], status: 'offline' }
            }));
        });
    };

    // Cleanup sockets on unmount
    useEffect(() => {
        return () => {
            Object.values(socketsRef.current).forEach(s => s.disconnect());
        };
    }, []);

    const vmList = Object.values(vms);

    if (vmList.length === 0) return (
        <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
            <h2>Searching for Agents...</h2>
            <p>Please ensure Agent is running and registered with Server.</p>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Infrastructure Overview</h1>
                <div>
                    <span className="badge badge-success">{vmList.length} Connected Agents</span>
                    <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Direct Mode Active</span>
                </div>
            </div>

            <div className="grid-vms">
                {vmList.map((vm) => (
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU</div>
                                <div style={{ fontWeight: 'bold', color: vm.cpu?.usage > 80 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                    {vm.cpu?.usage?.toFixed(1)}%
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Memory</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {vm.memory?.percent?.toFixed(1)}%
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Latency</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                                    Live
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
