import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function createNewSession() {
    const client = await pool.connect();
    try {
        const res1 = await client.query(`INSERT INTO study_sessions (user_id, started_at) VALUES (1, NOW()) RETURNING id`);
        const sessionId = res1.rows[0].id;
        console.log("Created test session:", sessionId);

        // 1 row 
        await client.query(`INSERT INTO session_telemetry (session_id, focus_score, stress_score, distracted_score, state_classification) VALUES ($1, 90, 0, 0, 'Focused')`, [sessionId]);

        console.log("Inserted 1 row. Fetching array buffer...");

        const res2 = await fetch(`http://localhost:8000/api/download_report/${sessionId}`);
        console.log("Download Status:", res2.status);
        if (!res2.ok) {
            console.log("Error body:", await res2.text());
        } else {
            console.log("PDF generated successfully for 1 row.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

createNewSession();
