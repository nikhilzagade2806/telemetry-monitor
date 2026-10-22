# Monitor

A Windows desktop telemetry dashboard built with Angular, TypeScript, Electron, and a small Node.js simulation API. It monitors velocity, pressure, and temperature with live gauges and trends.

## Requirements

- Node.js 18.19 or newer and npm
- Windows for the Electron desktop app

## Run the desktop app

From the project root, install dependencies and start the application:

```bash
npm install
npm run desktop
```

The desktop launcher starts the telemetry API on `127.0.0.1:3000`, starts Angular on `127.0.0.1:4200`, and opens the dashboard in Electron. Keep the terminal open while using the app. Close the Electron window or press `Ctrl+C` in the terminal to stop the services.

## Run in a browser

Start the API and Angular frontend in separate terminals from the project root:

Terminal 1:

```bash
npm run start:api
```

Terminal 2:

```bash
npm start
```

Open `http://localhost:4200`. If the API is not running, the dashboard displays a connection error and retries automatically.

## API

`GET http://127.0.0.1:3000/api/dashboard` returns current readings and up to 100 recent samples for each metric. The simulator updates every second, applies random changes of up to approximately 10% of each nominal value, and moves values toward their nominal values on every fifth update.

## Features

- Animated gauges, live readings, status indicators, and update times for velocity, pressure, and temperature.
- Runtime unit conversion without another API request:
  - Velocity: `mm/s`, `cm/s`, `m/s`, `km/h`, `ft/s`
  - Pressure: `Pa`, `kPa`, `mbar`, `bar`, `psi`, `atm`
  - Temperature: `°C`, `°F`, `K`
- Per-metric trend charts with up to 100 samples, timestamps, hover tooltips, zoom, and drag-to-pan.
- Light and dark themes, connection/loading/error states, and CSV and Excel-compatible `.xls` export.
- Responsive dashboard layout.

## Architecture and assumptions

- `src/app/` contains the Angular dashboard, one-second API polling, SVG charts and gauges, unit conversion, themes, and exports.
- `backend/server.js` is a dependency-free Node.js HTTP API and telemetry simulator.
- `electron/main.js` creates the desktop window with context isolation enabled and Node integration disabled. `scripts/run-desktop.js` starts the API and Angular server before Electron.
- The API readings use canonical units `cm/s`, `mbar`, and `°C`. Unit conversions happen in the renderer.
- Status thresholds are illustrative defaults and should be replaced with controller-specific limits for production.
- Export includes samples collected since the current dashboard session began.
- `npm run desktop` is a local development launcher, not a signed production installer.

## Build and tests

```bash
npm run build
npm test
```

Build output is written to `dist/`. Dependencies and generated build output are excluded from the source submission.
