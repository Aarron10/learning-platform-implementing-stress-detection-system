import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT id, title, attachment_url FROM assignments WHERE title = 'IHASBIDJIASHDISADN'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}
check();
