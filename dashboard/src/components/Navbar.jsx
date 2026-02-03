import React from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Navbar = () => {
    return (
        <nav style={{
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '1rem 0'
        }}>
            <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                    <Activity size={24} />
                    <span>System Monitor</span>
                </Link>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
