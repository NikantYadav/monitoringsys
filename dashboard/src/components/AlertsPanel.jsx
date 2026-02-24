import { useState, useEffect } from 'react';
import './AlertsPanel.css';
import config from '../config';

const AlertsPanel = ({ vmId, socket }) => {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all'); // all, warning, critical
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vmId) return;

    fetchAlerts();
    fetchStats();

    // Listen for real-time alert updates
    if (socket) {
      socket.on('alerts:new', handleNewAlerts);
    }

    const interval = setInterval(() => {
      fetchStats();
    }, 10000); // Refresh every 10 seconds

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('alerts:new', handleNewAlerts);
      }
    };
  }, [vmId, socket]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.SERVER_URL}/api/alerts/${vmId}?limit=50`);
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${config.SERVER_URL}/api/alerts/${vmId}/stats?period=24h`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching alert stats:', error);
    }
  };

  const handleNewAlerts = (data) => {
    if (data.vmId === vmId) {
      fetchAlerts();
      fetchStats();
      
      // Show browser notification for critical alerts
      data.alerts.forEach(alert => {
        if (alert.severity === 'critical' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Critical Alert', {
              body: alert.message,
              icon: '/alert-icon.png'
            });
          }
        }
      });
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString();
  };

  const getMetricTypeLabel = (metricType) => {
    // Handle undefined or null metricType
    if (!metricType) {
      return 'Unknown';
    }
    
    const labels = {
      'cpu_usage': 'CPU Usage',
      'load_average': 'Load Average',
      'memory_usage': 'Memory Usage',
      'swap_usage': 'Swap Usage',
      'disk_usage': 'Disk Usage',
      'disk_inodes': 'Disk Inodes',
      'disk_io_wait': 'Disk I/O Wait'
    };
    
    if (metricType.startsWith('service_')) {
      const serviceName = metricType.replace('service_', '');
      return `Service: ${serviceName}`;
    }
    
    return labels[metricType] || metricType;
  };

  if (loading) {
    return <div className="alerts-panel loading">Loading alerts...</div>;
  }

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <h2>Alerts</h2>
        {Notification.permission === 'default' && (
          <button onClick={requestNotificationPermission} className="btn-notification">
            Enable Notifications
          </button>
        )}
      </div>

      {stats && (
        <div className="alert-stats">
          <div className="stat-card warning">
            <div className="stat-value">{stats.warning_count || 0}</div>
            <div className="stat-label">Warnings (24h)</div>
          </div>
          <div className="stat-card critical">
            <div className="stat-value">{stats.critical_count || 0}</div>
            <div className="stat-label">Critical (24h)</div>
          </div>
          <div className="stat-card total">
            <div className="stat-value">{stats.total_count || 0}</div>
            <div className="stat-label">Total (24h)</div>
          </div>
        </div>
      )}

      <div className="alerts-filters">
        <div className="filter-group">
          <label>Severity:</label>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            <p>No alerts found</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={`alert-card ${alert.severity}`}
            >
              <div className="alert-header-row">
                <div className="alert-meta">
                  <span className="alert-severity">{alert.severity.toUpperCase()}</span>
                  <span className="alert-metric">{getMetricTypeLabel(alert.metric_type || alert.metricType)}</span>
                </div>
                <div className="alert-timestamp">
                  {formatTimestamp(alert.triggered_at || alert.triggeredAt)}
                </div>
              </div>
              
              <div className="alert-message">
                {alert.message}
              </div>
              
              <div className="alert-details">
                <span>Threshold: {alert.threshold_value || alert.thresholdValue}</span>
                <span>Current: {alert.current_value || alert.currentValue}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
