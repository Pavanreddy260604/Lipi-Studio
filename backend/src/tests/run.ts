import { colors, getTestSummary } from './framework.js';

// Print nice runner banner
console.log(`${colors.bold}${colors.yellow}====================================================${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}💥 BRUTAL MODULAR TESTING FRAMEWORK — SCRIPT CORE   ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}====================================================${colors.reset}`);

async function runAllTests() {
    try {
        // Dynamic imports of modular tests to execute their registrations
        await import('./jsonParser.test.js');
        await import('./rlhf.test.js');
        await import('./concurrency.test.js');
        await import('./brutalQa.test.js');
        await import('./formattingQa.test.js');
        await import('./intentRouting.test.js');
        await import('./vectorQuery.test.js');
        await import('./optimizeQa.test.js');

        // Let microtasks flush to ensure asynchronous test blocks settle
        await new Promise((resolve) => setTimeout(resolve, 500));

        const { passedCount, failedCount } = getTestSummary();

        console.log(`\n${colors.bold}${colors.yellow}====================================================${colors.reset}`);
        console.log(`${colors.bold}${colors.yellow}🏁 BRUTAL JUDGE RESULTS SUMMARY                    ${colors.reset}`);
        console.log(`${colors.bold}${colors.yellow}====================================================${colors.reset}`);
        
        if (failedCount > 0) {
            console.log(`${colors.bold}${colors.red}❌ FAILED TESTS DETECTED: ${failedCount}${colors.reset}`);
            console.log(`${colors.green}  Passed: ${passedCount}${colors.reset}`);
            console.log(`${colors.red}  Failed: ${failedCount}${colors.reset}`);
            console.log(`${colors.bold}${colors.yellow}====================================================${colors.reset}\n`);
            process.exit(1);
        } else {
            console.log(`${colors.bold}${colors.green}🎉 ALL SYSTEM COMPONENTS PASSED PERFECTLY!         ${colors.reset}`);
            console.log(`${colors.green}  Passed: ${passedCount}${colors.reset}`);
            console.log(`${colors.gray}  Failed: 0${colors.reset}`);
            console.log(`${colors.bold}${colors.yellow}====================================================${colors.reset}\n`);
            process.exit(0);
        }
    } catch (err) {
        console.error(`${colors.bold}${colors.red}💥 CRITICAL TESTING ENGINE CRASH:`, err, colors.reset);
        process.exit(1);
    }
}

void runAllTests();
