import { useState, useEffect } from 'react';
import './AlertRulesConfig.css';
import config from '../config';

const AlertRulesConfig = () => {
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.SERVER_URL}/api/alert-rules`);
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      setMessage('Error loading alert rules');
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${config.SERVER_URL}/api/alert-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules)
      });
      
      if (response.ok) {
        setMessage('Success: Alert rules saved successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: Failed to save alert rules');
      }
    } catch (error) {
      console.error('Error saving alert rules:', error);
      setMessage('Error: Failed to save alert rules');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (metricType, severity, field, value) => {
    setRules(prev => ({
      ...prev,
      [metricType]: {
        ...prev[metricType],
        [severity]: {
          ...prev[metricType][severity],
          [field]: field === 'duration' ? parseInt(value) : parseFloat(value)
        }
      }
    }));
  };

  const formatDuration = (ms) => {
    if (ms === 0) return 'Immediate';
    const minutes = ms / (60 * 1000);
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  };

  const ruleDescriptions = {
    cpu_usage: {
      name: 'CPU Usage',
      unit: '%'
    },
    load_average: {
      name: 'Load Average',
      unit: 'x cores'
    },
    memory_usage: {
      name: 'Memory Usage',
      unit: '%'
    },
    swap_usage: {
      name: 'Swap Usage',
      unit: '%'
    },
    disk_usage: {
      name: 'Disk Space',
      unit: '%'
    },
    disk_inodes: {
      name: 'Disk Inodes',
      unit: '%'
    },
    disk_io_wait: {
      name: 'Disk I/O Wait',
      unit: '%'
    }
  };

  if (loading) {
    return <div className="alert-rules-config loading">Loading alert rules...</div>;
  }

  if (!rules) {
    return <div className="alert-rules-config error">Failed to load alert rules</div>;
  }

  return (
    <div className="alert-rules-config">
      <div className="rules-header">
        <h2>Alert Rules Configuration</h2>
        <button 
          onClick={saveRules} 
          disabled={saving}
          className="btn-save"
        >
          {saving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>

      {message && (
        <div className={`message ${message.startsWith('Success') || message.includes('saved') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="rules-info">
        <p>Configure thresholds and durations for alerting. Duration specifies how long a threshold must be exceeded before triggering an alert.</p>
      </div>

      <div className="rules-list">
        {Object.entries(rules).map(([metricType, rule]) => {
          const desc = ruleDescriptions[metricType];
          if (!desc) return null;

          return (
            <div key={metricType} className="rule-card">
              <div className="rule-header">
                <h3>{desc.name}</h3>
              </div>

              <div className="rule-thresholds">
                <div className="threshold-section warning">
                  <h4>Warning</h4>
                  <div className="threshold-inputs">
                    <div className="input-group">
                      <label>Threshold:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.warning.threshold || rule.warning.multiplier || 0}
                        onChange={(e) => updateRule(
                          metricType, 
                          'warning', 
                          rule.warning.threshold !== undefined ? 'threshold' : 'multiplier',
                          e.target.value
                        )}
                      />
                      <span className="unit">{desc.unit}</span>
                    </div>
                    <div className="input-group">
                      <label>Duration:</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={rule.warning.duration / 60000}
                        onChange={(e) => updateRule(metricType, 'warning', 'duration', e.target.value * 60000)}
                      />
                      <span className="unit">minutes</span>
                    </div>
                  </div>
                </div>

                <div className="threshold-section critical">
                  <h4>Critical</h4>
                  <div className="threshold-inputs">
                    <div className="input-group">
                      <label>Threshold:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.critical.threshold || rule.critical.multiplier || 0}
                        onChange={(e) => updateRule(
                          metricType, 
                          'critical', 
                          rule.critical.threshold !== undefined ? 'threshold' : 'multiplier',
                          e.target.value
                        )}
                      />
                      <span className="unit">{desc.unit}</span>
                    </div>
                    <div className="input-group">
                      <label>Duration:</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={rule.critical.duration / 60000}
                        onChange={(e) => updateRule(metricType, 'critical', 'duration', e.target.value * 60000)}
                      />
                      <span className="unit">minutes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rules-footer">
        <button 
          onClick={saveRules} 
          disabled={saving}
          className="btn-save"
        >
          {saving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>
    </div>
  );
};

export default AlertRulesConfig;
