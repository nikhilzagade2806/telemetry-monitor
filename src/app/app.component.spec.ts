import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [AppComponent]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates the monitoring dashboard', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.metrics.length).toBe(3);
    fixture.destroy();
  });

  it('converts the displayed reading immediately when the unit changes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const timestamp = new Date().toISOString();
    app.applyTelemetry({
      timestamp,
      velocity: { value: 185.4, unit: 'cm/s', history: [{ time: timestamp, value: 185.4 }] },
      pressure: { value: 1012, unit: 'mbar', history: [{ time: timestamp, value: 1012 }] },
      temperature: { value: 36.8, unit: '°C', history: [{ time: timestamp, value: 36.8 }] }
    });

    app.setUnit('velocity', 'm/s');
    app.setUnit('temperature', '°F');

    expect(app.displayedValue('velocity')).toBeCloseTo(1.854);
    expect(app.displayedValue('temperature')).toBeCloseTo(98.24);
    fixture.destroy();
    http.expectNone('http://127.0.0.1:3000/api/dashboard');
  });

  it('polls telemetry and renders live metric readings', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    tick(0);
    const request = http.expectOne('http://127.0.0.1:3000/api/dashboard');
    const timestamp = new Date().toISOString();
    request.flush({
      timestamp,
      velocity: { value: 185.4, unit: 'cm/s', history: [{ time: timestamp, value: 185.4 }] },
      pressure: { value: 1012, unit: 'mbar', history: [{ time: timestamp, value: 1012 }] },
      temperature: { value: 36.8, unit: '°C', history: [{ time: timestamp, value: 36.8 }] }
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('185.4');
    expect(fixture.nativeElement.textContent).toContain('36.8');
    fixture.destroy();
  }));
});
