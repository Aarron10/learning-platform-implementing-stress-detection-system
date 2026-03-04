import { execSync } from 'child_process';
import net from 'net';

async function killPort() {
    console.log('Finding processes on port 5000...');
    try {
        const output = execSync('netstat -ano | findstr :5000').toString();
        console.log('netstat output:\n', output);

        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0') {
                    console.log(`Killing PID: ${pid}`);
                    try {
                        execSync(`taskkill /F /PID ${pid}`);
                        console.log(`Successfully killed PID ${pid}`);
                    } catch (e) {
                        console.error(`Failed to kill PID ${pid}`, e.message);
                    }
                }
            }
        }
    } catch (e) {
        console.log('No processes found on port 5000 via netstat.');
    }
}

killPort();
