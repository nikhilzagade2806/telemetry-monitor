const http = require('node:http');

const PORT = Number(process.env.API_PORT || 3000);
const HISTORY_LIMIT = 100;
const originalValues = { velocity: 185.4, pressure: 1012, temperature: 36.8 };
const values = { ...originalValues };
const histories = { velocity: [], pressure: [], temperature: [] };
let cycle = 0;

function sampleTime(date) {
  return date.toISOString();
}

function recordSample(date) {
  const time = sampleTime(date);
  for (const metric of Object.keys(values)) {
    histories[metric].push({ time, value: Number(values[metric].toFixed(2)) });
    if (histories[metric].length > HISTORY_LIMIT) histories[metric].shift();
  }
}

function seedHistory() {
  const now = Date.now();
  for (let index = HISTORY_LIMIT - 1; index >= 0; index -= 1) {
    const progress = (HISTORY_LIMIT - index) / HISTORY_LIMIT;
    const date = new Date(now - index * 1000);
    values.velocity = originalValues.velocity * (0.96 + 0.04 * progress) + Math.sin(index / 6) * 2.2;
    values.pressure = originalValues.pressure * (0.99 + 0.01 * progress) + Math.sin(index / 8) * 5;
    values.temperature = originalValues.temperature * (0.98 + 0.02 * progress) + Math.sin(index / 7) * 0.45;
    recordSample(date);
  }
  Object.assign(values, originalValues);
}

function updateTelemetry() {
  cycle += 1;
  for (const metric of Object.keys(values)) {
    const baseline = originalValues[metric];
    if (cycle % 5 === 0) {
      values[metric] += (baseline - values[metric]) * 0.35;
    } else {
      values[metric] += (Math.random() * 0.2 - 0.1) * baseline;
    }
    values[metric] = Math.max(baseline * 0.5, Math.min(baseline * 2, values[metric]));
  }
  recordSample(new Date());
}

function responseBody() {
  const latestTime = histories.velocity[histories.velocity.length - 1].time;
  return {
    timestamp: latestTime,
    velocity: { value: values.velocity, unit: 'cm/s', history: histories.velocity },
    pressure: { value: values.pressure, unit: 'mbar', history: histories.pressure },
    temperature: { value: values.temperature, unit: '°C', history: histories.temperature }
  };
}

seedHistory();
setInterval(updateTelemetry, 1000);

const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && request.url === '/api/dashboard') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(responseBody()));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Telemetry API listening at http://127.0.0.1:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
