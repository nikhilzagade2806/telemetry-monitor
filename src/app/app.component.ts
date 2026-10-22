import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';

type MetricId = 'velocity' | 'pressure' | 'temperature';
type MetricStatus = 'Normal' | 'Warning' | 'Critical';

interface TelemetryPoint {
  time: string;
  value: number;
}

interface MetricReading {
  value: number;
  unit: string;
  history: TelemetryPoint[];
}

interface DashboardResponse {
  timestamp: string;
  velocity: MetricReading;
  pressure: MetricReading;
  temperature: MetricReading;
}

interface MetricConfig {
  id: MetricId;
  label: string;
  description: string;
  icon: string;
  color: string;
  units: string[];
  baseUnit: string;
  gaugeMax: number;
  decimals: number;
}

interface ExportSample {
  timestamp: string;
  velocity: number;
  pressure: number;
  temperature: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  readonly metrics: MetricConfig[] = [
    {
      id: 'velocity', label: 'Velocity', description: 'Rotational speed',
      icon: '↗', color: '#5d8bff', units: ['mm/s', 'cm/s', 'm/s', 'km/h', 'ft/s'],
      baseUnit: 'cm/s', gaugeMax: 300, decimals: 1
    },
    {
      id: 'pressure', label: 'Pressure', description: 'System pressure',
      icon: '◉', color: '#a17cff', units: ['Pa', 'kPa', 'mbar', 'bar', 'psi', 'atm'],
      baseUnit: 'mbar', gaugeMax: 1200, decimals: 1
    },
    {
      id: 'temperature', label: 'Temperature', description: 'Core temperature',
      icon: '♨', color: '#ff9a66', units: ['°C', '°F', 'K'],
      baseUnit: '°C', gaugeMax: 100, decimals: 1
    }
  ];
  readonly circumference = 2 * Math.PI * 45;
  readonly chartWidth = 760;
  readonly chartHeight = 190;
  readonly chartPadding = { left: 44, right: 14, top: 18, bottom: 28 };

  selectedUnits: Record<MetricId, string> = {
    velocity: 'cm/s', pressure: 'mbar', temperature: '°C'
  };
  readings: Record<MetricId, MetricReading> = {
    velocity: { value: 0, unit: 'cm/s', history: [] },
    pressure: { value: 0, unit: 'mbar', history: [] },
    temperature: { value: 0, unit: '°C', history: [] }
  };
  connected = false;
  loading = true;
  errorMessage = '';
  lastUpdated: Date | null = null;
  darkTheme = false;
  zoom = 1;
  panOffset = 0;
  collectedCount = 0;
  tooltip: { x: number; y: number; time: string; value: number; metric: MetricId } | null = null;
  private readonly collected = new Map<string, ExportSample>();
  private pollSubscription?: Subscription;
  private dragStartX: number | null = null;
  private readonly chartInnerWidth = this.chartWidth - this.chartPadding.left - this.chartPadding.right;
  private readonly chartInnerHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.pollSubscription = timer(0, 1000).pipe(
      switchMap(() => this.http.get<DashboardResponse>('http://127.0.0.1:3000/api/dashboard').pipe(
        catchError((error: unknown) => {
          this.connected = false;
          this.loading = false;
          this.errorMessage = error instanceof Error
            ? `Unable to reach telemetry service: ${error.message}`
            : 'Unable to reach telemetry service. Check that the backend is running.';
          return of(null);
        })
      ))
    ).subscribe((response) => {
      if (response) {
        this.applyTelemetry(response);
      }
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  applyTelemetry(response: DashboardResponse): void {
    for (const metric of this.metrics) {
      const incoming = response[metric.id];
      const history = incoming.history.map((point) => ({ ...point }));
      const latestPoint = history[history.length - 1];
      if (!latestPoint || latestPoint.time !== response.timestamp) {
        history.push({ time: response.timestamp, value: incoming.value });
      }
      this.readings[metric.id] = { value: incoming.value, unit: incoming.unit, history: history.slice(-100) };
    }

    const existing = this.collected.get(response.timestamp);
    this.collected.set(response.timestamp, {
      timestamp: response.timestamp,
      velocity: response.velocity.value,
      pressure: response.pressure.value,
      temperature: response.temperature.value
    });
    if (existing) {
      this.collected.set(response.timestamp, existing);
    }
    this.collectedCount = this.collected.size;
    this.connected = true;
    this.loading = false;
    this.errorMessage = '';
    this.lastUpdated = new Date(response.timestamp);
  }

  setUnit(metric: MetricId, unit: string): void {
    this.selectedUnits[metric] = unit;
    this.tooltip = null;
  }

  displayedValue(metric: MetricId, value = this.readings[metric].value): number {
    return this.convert(value, this.metrics.find((item) => item.id === metric)!, this.selectedUnits[metric]);
  }

  formattedValue(metric: MetricId, value = this.displayedValue(metric)): string {
    const decimals = metric === 'pressure' && ['Pa', 'kPa'].includes(this.selectedUnits.pressure) ? 0 : 1;
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  statusFor(metric: MetricId): MetricStatus {
    const value = this.readings[metric].value;
    if (metric === 'velocity') {
      return value >= 260 ? 'Critical' : value >= 230 ? 'Warning' : 'Normal';
    }
    if (metric === 'pressure') {
      return value < 940 || value > 1080 ? 'Critical' : value < 970 || value > 1040 ? 'Warning' : 'Normal';
    }
    return value >= 65 ? 'Critical' : value >= 50 ? 'Warning' : 'Normal';
  }

  gaugeOffset(metric: MetricId): number {
    const config = this.metrics.find((item) => item.id === metric)!;
    const ratio = Math.max(0, Math.min(this.displayedValue(metric) / this.displayedGaugeMax(config), 1));
    return this.circumference * (1 - ratio);
  }

  displayGaugeMax(metric: MetricId): number {
    return this.displayedGaugeMax(this.metrics.find((item) => item.id === metric)!);
  }

  chartPoints(metric: MetricId): TelemetryPoint[] {
    const history = this.readings[metric].history;
    const count = Math.max(2, Math.floor(100 / this.zoom));
    const end = Math.max(0, history.length - this.panOffset);
    return history.slice(Math.max(0, end - count), end);
  }

  chartPath(metric: MetricId): string {
    const points = this.chartPoints(metric);
    if (!points.length) return '';
    return points.map((point, index) => {
      const { x, y } = this.pointPosition(metric, point.value, index, points.length);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  chartArea(metric: MetricId): string {
    const points = this.chartPoints(metric);
    if (!points.length) return '';
    const first = this.pointPosition(metric, points[0].value, 0, points.length);
    const last = this.pointPosition(metric, points[points.length - 1].value, points.length - 1, points.length);
    return `${this.chartPath(metric)} L ${last.x.toFixed(1)} ${(this.chartHeight - this.chartPadding.bottom).toFixed(1)} L ${first.x.toFixed(1)} ${(this.chartHeight - this.chartPadding.bottom).toFixed(1)} Z`;
  }

  chartY(metric: MetricId, tick: number): number {
    const range = this.chartRange(metric);
    return this.chartPadding.top + this.chartInnerHeight * (1 - (tick - range.min) / (range.max - range.min));
  }

  chartTicks(metric: MetricId): number[] {
    const range = this.chartRange(metric);
    return Array.from({ length: 4 }, (_, index) => range.min + (range.max - range.min) * index / 3);
  }

  chartLabel(metric: MetricId, value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  chartTimeLabel(metric: MetricId, index: number): string {
    const points = this.chartPoints(metric);
    const point = points[index];
    if (!point) return '';
    const date = new Date(point.time);
    return Number.isNaN(date.getTime()) ? point.time.slice(-8) : date.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
  }

  onChartMove(event: PointerEvent, metric: MetricId): void {
    if (this.dragStartX !== null) {
      const delta = Math.round((this.dragStartX - event.clientX) / 8);
      if (Math.abs(delta) > 0) {
        this.panOffset = Math.max(0, Math.min(99, this.panOffset + delta));
        this.dragStartX = event.clientX;
      }
      return;
    }
    const svg = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = (event.clientX - svg.left) / svg.width * this.chartWidth;
    const points = this.chartPoints(metric);
    if (!points.length) return;
    const index = Math.max(0, Math.min(points.length - 1,
      Math.round((x - this.chartPadding.left) / this.chartInnerWidth * (points.length - 1))));
    const point = points[index];
    const position = this.pointPosition(metric, point.value, index, points.length);
    this.tooltip = {
      x: position.x, y: position.y,
      time: new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      value: this.convert(point.value, this.metrics.find((item) => item.id === metric)!, this.selectedUnits[metric]),
      metric
    };
  }

  onChartLeave(): void {
    this.dragStartX = null;
    this.tooltip = null;
  }

  onChartPointerDown(event: PointerEvent): void {
    this.dragStartX = event.clientX;
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
  }

  onChartPointerUp(): void {
    this.dragStartX = null;
  }

  zoomIn(): void {
    this.zoom = Math.min(5, this.zoom * 1.25);
    this.panOffset = Math.min(this.panOffset, Math.max(0, this.readings.velocity.history.length - 2));
  }

  zoomOut(): void {
    this.zoom = Math.max(1, this.zoom / 1.25);
    if (this.zoom === 1) this.panOffset = 0;
  }

  resetChart(): void {
    this.zoom = 1;
    this.panOffset = 0;
  }

  toggleTheme(): void {
    this.darkTheme = !this.darkTheme;
  }

  exportCsv(): void {
    const header = [
      'Timestamp',
      `Velocity (${this.selectedUnits.velocity})`,
      `Pressure (${this.selectedUnits.pressure})`,
      `Temperature (${this.selectedUnits.temperature})`
    ];
    const rows = Array.from(this.collected.values()).map((sample) => [
      sample.timestamp,
      this.displayedValue('velocity', sample.velocity),
      this.displayedValue('pressure', sample.pressure),
      this.displayedValue('temperature', sample.temperature)
    ]);
    this.downloadFile([header, ...rows].map((row) => row.map(this.csvCell).join(',')).join('\r\n'),
      `telemetry-${this.fileTimestamp()}.csv`, 'text/csv;charset=utf-8');
  }

  exportExcel(): void {
    const headers = [
      'Timestamp',
      `Velocity (${this.selectedUnits.velocity})`,
      `Pressure (${this.selectedUnits.pressure})`,
      `Temperature (${this.selectedUnits.temperature})`
    ];
    const rows = Array.from(this.collected.values()).map((sample) => [
      sample.timestamp,
      this.displayedValue('velocity', sample.velocity),
      this.displayedValue('pressure', sample.pressure),
      this.displayedValue('temperature', sample.temperature)
    ]);
    const xmlCell = (value: string | number): string => {
      const type = typeof value === 'number' ? 'Number' : 'String';
      const safeValue = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<Cell><Data ss:Type="${type}">${safeValue}</Data></Cell>`;
    };
    const worksheet = [headers, ...rows]
      .map((row) => `<Row>${row.map(xmlCell).join('')}</Row>`)
      .join('');
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Telemetry"><Table>${worksheet}</Table></Worksheet></Workbook>`;
    this.downloadFile(workbook, `telemetry-${this.fileTimestamp()}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  }

  private convert(value: number, metric: MetricConfig, unit: string): number {
    if (metric.id === 'velocity') {
      const metersPerSecond = value / 100;
      const conversions: Record<string, number> = {
        'mm/s': metersPerSecond * 1000, 'cm/s': value, 'm/s': metersPerSecond,
        'km/h': metersPerSecond * 3.6, 'ft/s': metersPerSecond * 3.28084
      };
      return conversions[unit];
    }
    if (metric.id === 'pressure') {
      const pascals = value * 100;
      const conversions: Record<string, number> = {
        Pa: pascals, kPa: pascals / 1000, mbar: value, bar: value / 1000,
        psi: value * 0.0145038, atm: value / 1013.25
      };
      return conversions[unit];
    }
    const celsius = value;
    if (unit === '°F') return celsius * 9 / 5 + 32;
    if (unit === 'K') return celsius + 273.15;
    return celsius;
  }

  private displayedGaugeMax(metric: MetricConfig): number {
    return this.convert(metric.gaugeMax, metric, this.selectedUnits[metric.id]);
  }

  private chartRange(metric: MetricId): { min: number; max: number } {
    const points = this.chartPoints(metric);
    const config = this.metrics.find((item) => item.id === metric)!;
    const values = points.map((point) => this.convert(point.value, config, this.selectedUnits[metric]));
    if (!values.length) return { min: 0, max: Math.max(1, this.displayedGaugeMax(config)) };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.22, Math.abs(max) * 0.003, 0.1);
    return { min: min - padding, max: max + padding };
  }

  private pointPosition(metric: MetricId, value: number, index: number, count: number): { x: number; y: number } {
    const config = this.metrics.find((item) => item.id === metric)!;
    const displayed = this.convert(value, config, this.selectedUnits[metric]);
    const range = this.chartRange(metric);
    const x = this.chartPadding.left + (count <= 1 ? 0 : this.chartInnerWidth * index / (count - 1));
    const y = this.chartPadding.top + this.chartInnerHeight * (1 - (displayed - range.min) / (range.max - range.min));
    return { x, y };
  }

  private csvCell(value: string | number): string {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private fileTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
