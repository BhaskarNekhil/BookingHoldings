const fs = require('node:fs');
const path = require('node:path');

const logDir = path.resolve(__dirname, '../../logs');
fs.mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, 'api.log');

function write(level, event) {
  const row = JSON.stringify({ at: new Date().toISOString(), level, ...event }) + '\n';
  fs.appendFileSync(logPath, row, { encoding: 'utf8' });
}

module.exports = {
  info: (event) => write('info', event),
  error: (event) => write('error', event),
};
