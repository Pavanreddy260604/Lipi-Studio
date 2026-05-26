import { Request, Response } from 'express';

// Zero-overhead high-performance no-op mock classes to replace prom-client types
class MockHistogram {
    constructor(options: any) {}
    startTimer() {
        return () => 0;
    }
    observe(val: number) {}
}

class MockCounter {
    constructor(options: any) {}
    inc(labelsOrVal?: any) {}
}

class MockGauge {
    constructor(options: any) {}
    set(val: number) {}
    inc(val?: number) {}
    dec(val?: number) {}
}

export const httpRequestDuration = new MockHistogram({});
export const httpRequestsTotal = new MockCounter({});
export const activeUsersGauge = new MockGauge({});
export const totalProjectsGauge = new MockGauge({});
export const totalScenesGauge = new MockGauge({});
export const rlhfFeedbacksGauge = new MockGauge({});
export const rlhfAccuracyGauge = new MockGauge({});

export function startMetricsCollection() {
    // No-op: Telemetry collection completely disabled for high performance
}

export function stopMetricsCollection() {
    // No-op
}

export function metricsMiddleware(req: Request, res: Response, next: () => void) {
    // Pass-through: Zero overhead request monitoring bypass
    next();
}

export async function metricsHandler(_req: Request, res: Response) {
    res.set('Content-Type', 'text/plain');
    res.send('# Telemetry decommissioned for high performance');
}
