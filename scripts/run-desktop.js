const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nodeCommand = process.execPath;
const children = [];
let stopping = false;

function start(command, args, name, restartOnExit = false) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
  children.push(child);
  child.on('error', (error) => {
    if (!stopping) {
      console.error(`Unable to start ${name}: ${error.message}`);
      stop(1);
    }
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (restartOnExit) {
      console.error(`${name} exited unexpectedly (code ${code ?? 'unknown'}, signal ${signal ?? 'none'}); restarting in 1 second`);
      setTimeout(() => {
        if (!stopping) start(command, args, name, true);
      }, 1000);
    } else if (code !== 0 || signal) {
      console.error(`${name} exited (code ${code ?? 'unknown'}, signal ${signal ?? 'none'})`);
      stop(code || 1);
    }
  });
  return child;
}

function waitFor(url, attempts = 90) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry(remaining);
      });
      request.on('error', () => retry(remaining));
      request.setTimeout(1000, () => request.destroy());
      function retry(left) {
        if (left <= 0) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(() => check(left - 1), 1000);
      }
    };
    check(attempts);
  });
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = code;
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

async function main() {
  start(nodeCommand, [path.join(root, 'backend', 'server.js')], 'Telemetry API', true);
  start(nodeCommand, [path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'), 'serve', '--host', '127.0.0.1'], 'Angular dev server');
  await Promise.all([waitFor('http://127.0.0.1:3000/api/dashboard'), waitFor('http://127.0.0.1:4200')]);
  const electronPath = require('electron');
  const desktop = start(electronPath, [path.join(root, 'electron', 'main.js')], 'Electron');
  desktop.on('exit', (code) => stop(code || 0));
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
