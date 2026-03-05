import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const client = await pool.connect();
    try {
        const res1 = await client.query(`SELECT id, started_at FROM study_sessions ORDER BY id DESC LIMIT 2`);

        for (const row of res1.rows) {
            const res2 = await client.query(`SELECT COUNT(*) FROM session_telemetry WHERE session_id = $1`, [row.id]);
            if (res2.rows[0].count > 0) {
                const sample = await client.query(`SELECT * FROM session_telemetry WHERE session_id = $1 LIMIT 1`, [row.id]);
                fs.appendFileSync('latest_out.json', JSON.stringify(sample.rows[0], null, 2) + '\n');
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
