#!/usr/bin/env node
/**
 * Stops the VSC Scheduler server by killing only the process bound to PORT.
 *
 * Avoids the footgun of `taskkill /F /IM node.exe /T` which would terminate
 * every Node process on the machine (VS Code, other agents, build tools, etc.).
 *
 * Strategy: parse `netstat -ano` output for a LISTENING entry on the configured
 * PORT, then taskkill that single PID.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load PORT from .env if present (minimal parser, no dependency on dotenv here)
function loadPort() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return 3000;
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^\s*PORT\s*=\s*(\d+)/m);
  return match ? Number(match[1]) : 3000;
}

const port = loadPort();

function findListeningPid(targetPort) {
  try {
    const output = execSync('netstat -ano -p TCP', { encoding: 'utf8' });
    const lines = output.split(/\r?\n/);
    // Lines look like:  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
    for (const line of lines) {
      const m = line.match(new RegExp(`\\sLISTENING\\s+(\\d+)\\s*$`));
      if (!m) continue;
      if (line.includes(`:${targetPort}`) || line.includes(`[::]:${targetPort}`)) {
        return Number(m[1]);
      }
    }
  } catch (err) {
    console.error('Failed to query netstat:', err.message);
  }
  return null;
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

const pid = findListeningPid(port);
if (pid === null) {
  console.log(`No process listening on port ${port}. Nothing to stop.`);
  process.exit(0);
}

console.log(`Stopping VSC Scheduler (PID ${pid} on port ${port})...`);
if (killPid(pid)) {
  console.log('Stopped.');
} else {
  console.error(`Failed to kill PID ${pid}. It may have already exited.`);
  process.exit(1);
}