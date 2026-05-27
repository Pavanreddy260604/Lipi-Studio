import { Request, Response } from 'express';
import client from 'prom-client';

// Initialize default metrics collection (CPU, Memory, Event loop lag, etc.)
export function startMetricsCollection() {
    client.collectDefaultMetrics({ register: client.register });
}

export function stopMetricsCollection() {
    client.register.clear();
}

// Define custom Prometheus metrics
export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests made.',
    labelNames: ['method', 'route', 'status_code']
});

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 1.5, 2, 5, 10]
});

// App metrics stubs
export const activeUsersGauge = new client.Gauge({
    name: 'active_users',
    help: 'Number of active users.'
});

export const totalProjectsGauge = new client.Gauge({
    name: 'total_projects',
    help: 'Total number of projects in the system.'
});

export const totalScenesGauge = new client.Gauge({
    name: 'total_scenes',
    help: 'Total number of scenes created.'
});

export const rlhfFeedbacksGauge = new client.Gauge({
    name: 'rlhf_feedbacks_total',
    help: 'Total number of RLHF feedbacks received.'
});

export const rlhfAccuracyGauge = new client.Gauge({
    name: 'rlhf_accuracy_percentage',
    help: 'Average accuracy rating percentage.'
});

// Middleware to record request metrics
export function metricsMiddleware(req: Request, res: Response, next: () => void) {
    const start = process.hrtime();
    
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const duration = diff[0] + diff[1] / 1e9;
        
        // Resolve express route path (e.g. /api/script/:id) or fallback to path
        const route = req.route ? req.route.path : req.path;
        const method = req.method;
        const statusCode = String(res.statusCode);
        
        // Increment count and observe duration
        httpRequestsTotal.inc({ method, route, status_code: statusCode });
        httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    });
    
    next();
}

// Prometheus metrics endpoint handler
export async function metricsHandler(_req: Request, res: Response) {
    try {
        res.set('Content-Type', client.register.contentType);
        res.send(await client.register.metrics());
    } catch (err: any) {
        res.status(500).send(err.message);
    }
}
