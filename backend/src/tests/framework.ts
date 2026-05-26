export class AssertionError extends Error {
    constructor(public actual: any, public expected: any, message: string) {
        super(message);
        this.name = 'AssertionError';
    }
}

export const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

let currentSuite = '';
let passedCount = 0;
let failedCount = 0;

export function describe(name: string, fn: () => void) {
    currentSuite = name;
    console.log(`\n${colors.bold}${colors.cyan}● ${name}${colors.reset}`);
    try {
        fn();
    } catch (err) {
        console.error(`${colors.red}  Suite failed to run: ${err}${colors.reset}`);
    }
}

export function it(description: string, fn: () => void | Promise<void>) {
    const runTest = async () => {
        try {
            const result = fn();
            if (result instanceof Promise) {
                await result;
            }
            passedCount++;
            console.log(`  ${colors.green}✓${colors.reset} ${colors.gray}${description}${colors.reset}`);
        } catch (err: any) {
            failedCount++;
            console.log(`  ${colors.red}✗${colors.reset} ${colors.bold}${description}${colors.reset}`);
            if (err instanceof AssertionError) {
                console.log(`    ${colors.red}Expected: ${JSON.stringify(err.expected)}${colors.reset}`);
                console.log(`    ${colors.red}Received: ${JSON.stringify(err.actual)}${colors.reset}`);
            } else {
                console.log(`    ${colors.red}Error: ${err.stack || err.message || err}${colors.reset}`);
            }
        }
    };

    // Queue test for execution
    runTest();
}

export const expect = (actual: any) => ({
    toBe: (expected: any) => {
        if (actual !== expected) {
            throw new AssertionError(actual, expected, `Expected ${actual} to be ${expected}`);
        }
    },
    toEqual: (expected: any) => {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
            throw new AssertionError(actual, expected, `Expected ${a} to equal ${b}`);
        }
    },
    toContain: (expected: any) => {
        if (typeof actual?.includes === 'function') {
            if (!actual.includes(expected)) {
                throw new AssertionError(actual, expected, `Expected ${actual} to contain ${expected}`);
            }
        } else {
            throw new AssertionError(actual, expected, `Expected value to have contains capability`);
        }
    },
    toThrow: () => {
        let threw = false;
        try {
            actual();
        } catch (err) {
            threw = true;
        }
        if (!threw) {
            throw new AssertionError('no throw', 'throw', 'Expected function to throw an error');
        }
    },
    toBeDefined: () => {
        if (actual === undefined) {
            throw new AssertionError(actual, 'defined', 'Expected value to be defined');
        }
    },
    toBeNull: () => {
        if (actual !== null) {
            throw new AssertionError(actual, null, 'Expected value to be null');
        }
    },
    toBeGreaterThan: (expected: number) => {
        if (typeof actual !== 'number' || actual <= expected) {
            throw new AssertionError(actual, expected, `Expected ${actual} to be greater than ${expected}`);
        }
    },
    toBeLessThan: (expected: number) => {
        if (typeof actual !== 'number' || actual >= expected) {
            throw new AssertionError(actual, expected, `Expected ${actual} to be less than ${expected}`);
        }
    },
    toBeGreaterThanOrEqual: (expected: number) => {
        if (typeof actual !== 'number' || actual < expected) {
            throw new AssertionError(actual, expected, `Expected ${actual} to be greater than or equal to ${expected}`);
        }
    },
    toBeLessThanOrEqual: (expected: number) => {
        if (typeof actual !== 'number' || actual > expected) {
            throw new AssertionError(actual, expected, `Expected ${actual} to be less than or equal to ${expected}`);
        }
    }
});

export function getTestSummary() {
    return { passedCount, failedCount };
}
