-- Drop old alerts table completely
DROP TABLE IF EXISTS alerts CASCADE;

-- Create new alerts table (simple notification log - no state column)
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    vm_id TEXT NOT NULL,
    hostname TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    threshold_value TEXT NOT NULL,
    current_value TEXT NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for alerts
CREATE INDEX idx_alerts_vm_id_triggered ON alerts (vm_id, triggered_at DESC);
CREATE INDEX idx_alerts_triggered ON alerts (triggered_at DESC);

-- Verify the new schema
\d alerts
