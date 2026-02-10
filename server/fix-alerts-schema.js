require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
});

async function fixAlertsSchema() {
    const client = await pool.connect();
    try {
        console.log('Fixing alerts table schema...\n');
        
        // Check if alerts table exists
        const checkTable = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'alerts'
            );
        `);
        
        if (checkTable.rows[0].exists) {
            console.log('Found existing alerts table');
            
            // Check current schema
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'alerts'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nCurrent schema:');
            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });
            
            // Drop the old table
            console.log('\nDropping old alerts table...');
            await client.query('DROP TABLE IF EXISTS alerts CASCADE;');
            console.log('✓ Dropped old alerts table');
        } else {
            console.log('No existing alerts table found');
        }
        
        // Create new alerts table (simple notification log)
        console.log('\nCreating new alerts table...');
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
        console.log('\nCreating indexes...');
        await client.query(`
            CREATE INDEX idx_alerts_vm_id_triggered 
            ON alerts (vm_id, triggered_at DESC);
        `);
        await client.query(`
            CREATE INDEX idx_alerts_triggered 
            ON alerts (triggered_at DESC);
        `);
        console.log('✓ Created alert indexes');
        
        // Verify new schema
        const newColumns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'alerts'
            ORDER BY ordinal_position;
        `);
        
        console.log('\nNew schema:');
        newColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        console.log('\n✓ Migration complete!');
        console.log('\nYou can now restart your server.');
    } catch (error) {
        console.error('\n✗ Migration failed:', error.message);
        console.error(error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixAlertsSchema()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error('\nFailed to fix alerts schema');
        process.exit(1);
    });
