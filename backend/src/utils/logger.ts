type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

const envLevel = (process.env.LOG_LEVEL || '').toLowerCase() as LogLevel;
const DEFAULT_LEVEL: LogLevel =
    envLevel in LEVEL_PRIORITY
        ? envLevel
        : process.env.NODE_ENV === 'production'
            ? 'info'
            : 'debug';

const IS_PROD = process.env.NODE_ENV === 'production';

const serializeError = (err: unknown): Record<string, unknown> => {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
            ...(err as unknown as Record<string, unknown>),
        };
    }
    return { value: err };
};

const normalize = (data: Record<string, unknown> | undefined): Record<string, unknown> => {
    if (!data) return {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        if (key === 'err' || key === 'error') {
            out[key] = serializeError(value);
        } else {
            out[key] = value;
        }
    }
    return out;
};

interface Logger {
    debug(event: string, data?: Record<string, unknown>): void;
    info(event: string, data?: Record<string, unknown>): void;
    warn(event: string, data?: Record<string, unknown>): void;
    error(event: string, data?: Record<string, unknown>): void;
    child(bindings: Record<string, unknown>): Logger;
}

const makeLogger = (bindings: Record<string, unknown> = {}, minLevel: LogLevel = DEFAULT_LEVEL): Logger => {
    const emit = (level: LogLevel, event: string, data?: Record<string, unknown>) => {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

        const record = {
            level,
            time: new Date().toISOString(),
            event,
            ...bindings,
            ...normalize(data),
        };

        const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

        if (IS_PROD) {
            sink(JSON.stringify(record));
        } else {
            const { level: _l, time: _t, event: _e, ...rest } = record;
            const tag = level.toUpperCase().padEnd(5);
            const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
            sink(`[${tag}] ${event}${extra}`);
        }
    };

    return {
        debug: (event, data) => emit('debug', event, data),
        info: (event, data) => emit('info', event, data),
        warn: (event, data) => emit('warn', event, data),
        error: (event, data) => emit('error', event, data),
        child: (extra) => makeLogger({ ...bindings, ...extra }, minLevel),
    };
};

export const logger: Logger = makeLogger();
