require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

async function migrateAlerts() {
    const client = await pool.connect();
    try {
        console.log('Starting alerts table migration...');
        
        // Drop old alerts table
        await client.query('DROP TABLE IF EXISTS alerts CASCADE;');
        console.log('✓ Dropped old alerts table');
        
        // Create new alerts table (simple notification log)
        await client.query(`
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
        `);
        console.log('✓ Created new alerts table');
        
        // Create indexes for alerts
        await client.query(`
            CREATE INDEX idx_alerts_vm_id_triggered 
            ON alerts (vm_id, triggered_at DESC);
        `);
        await client.query(`
            CREATE INDEX idx_alerts_triggered 
            ON alerts (triggered_at DESC);
        `);
        console.log('✓ Created alert indexes');
        
        console.log('✓ Migration complete!');
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrateAlerts()
    .then(() => {
        console.log('\nAlerts table successfully migrated to notification-only schema.');
        console.log('You can now restart your server.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\nMigration failed:', err);
        process.exit(1);
    });
