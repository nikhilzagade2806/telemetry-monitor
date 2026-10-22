# Nexus Monitor

A Windows desktop telemetry dashboard built with Angular, TypeScript, Electron, and a small Node.js simulation API. The dashboard monitors velocity, pressure, and temperature with live gauges and trends.

## Requirements

- Node.js 18.19+ and npm
- Windows for the desktop application (the Angular dashboard and API also run on other platforms)

## Run the Windows desktop application

```bash
npm install
npm run desktop
```

This starts the telemetry API on `127.0.0.1:3000`, the Angular development server on `127.0.0.1:4200`, and opens the dashboard in Electron. Close the Electron window or press `Ctrl+C` in the terminal to stop the processes.

To use the dashboard in a browser instead, start the backend and frontend in separate terminals:

```bash
npm run start:api
npm start
```

Open `http://localhost:4200`.

## API

`GET http://127.0.0.1:3000/api/dashboard` returns the current readings and each metric's most recent 100 samples. The built-in simulator updates once per second, applies random changes of up to roughly 10% of each nominal value, and moves readings gradually toward their nominal values on every fifth update.

## Features

- Three live telemetry cards with animated SVG gauges, normal/warning/critical status, current units, and last-update time.
- Independent unit selectors for velocity (`mm/s`, `cm/s`, `m/s`, `km/h`, `ft/s`), pressure (`Pa`, `kPa`, `mbar`, `bar`, `psi`, `atm`), and temperature (`°C`, `°F`, `K`). Conversion is performed in the renderer from canonical API readings; changing units does not request new data.
- Per-metric line graphs with up to 100 samples, timestamp and value axes, hover tooltips, zoom controls, and drag-to-pan.
- Light and dark themes, connection/loading/error states, and CSV/Excel-compatible export of samples collected during the current application session.
- Responsive layout for desktop and smaller screens.

## Architecture and decisions

- `src/app/` contains the Angular dashboard and its polling, unit conversion, SVG gauge/chart rendering, theme, and export behavior. The UI polls the API every second using `HttpClient`; API failures remain visible and polling retries automatically.
- `backend/server.js` is a dependency-free Node HTTP server and telemetry simulator. It seeds a full 100-point window, then maintains a rolling 100-sample history for each parameter.
- `electron/main.js` creates a sandboxed desktop window with context isolation and Node integration disabled. `scripts/run-desktop.js` starts the API and Angular development server before launching Electron.
- Trend charts use SVG rather than a chart library to keep the dependency footprint small and to make unit conversion and rolling-window updates straightforward.
- Excel export uses Excel-compatible SpreadsheetML (`.xls`); CSV export uses properly quoted CSV. Both contain timestamps and all three parameters in the units selected at export time.

## Assumptions

- The API's canonical units are `cm/s`, `mbar`, and `°C`; all conversions and status thresholds operate from these readings.
- Normal operating limits are illustrative dashboard defaults: velocity warning/critical at 230/260 cm/s, pressure outside 970–1040 mbar (warning) or 940–1080 mbar (critical), and temperature warning/critical at 50/65 °C. These should be replaced with controller-specific limits for production use.
- Export includes samples received since the dashboard session began. The charts show the latest 100 samples, matching the backend's rolling history.
- The desktop command is a development launcher and runs the Angular development server locally; it is intended for assessment and local demonstration, not a signed production installer.

## Build and tests

```bash
npm run build
npm test
```

Angular build output is written under `dist/`; generated dependencies and build output are excluded from source submissions.
