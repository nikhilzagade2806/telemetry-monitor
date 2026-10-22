#  Monitor

A Windows desktop telemetry dashboard built with Angular, TypeScript, Electron, and a small Node.js simulation API. The dashboard monitors velocity, pressure, and temperature with live gauges and trends.

## Requirements

- Node.js 18.19+ and npm
- Windows for the desktop application (the Angular dashboard and API also run on other platforms)

## Run the Windows desktop application

```bash
npm install
npm run desktop

## Build and tests

```bash
npm run build
npm test
```

Angular build output is written under `dist/`; generated dependencies and build output are excluded from source submissions.
