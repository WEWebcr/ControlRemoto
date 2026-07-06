const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'keepalive.log');

console.log('Keepalive test started.');
console.log(`Logging to: ${logPath}`);

fs.appendFileSync(logPath, `=== TEST STARTED AT ${new Date().toISOString()} ===\n`);

setInterval(() => {
  const entry = `${new Date().toISOString()} - Server process is running.\n`;
  try {
    fs.appendFileSync(logPath, entry);
    console.log(entry.trim());
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}, 10000);
