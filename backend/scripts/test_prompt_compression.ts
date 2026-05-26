import { scriptGenerator } from '../src/services/scriptGenerator.service';

function runPromptCompressionTest() {
    console.log('--- STARTING PROMPT COMPRESSION TEST ---');

    // Simulate a bloated chat history containing multiple heavy screenplay drafts
    const mockHeavyScript = `
    INT. ADIRATHA’S HUMBLE HUT – NIGHT
    A single oil lamp gutters on a wooden stool, its flame a restless tongue.
    KARNA kneels by the lamp, his shadow stretching long and jagged across the wall.
    (whispering)
    You see me.
    ` + ' '.repeat(5000); // 5KB of dummy script spacing padding to simulate long draft

    const entries: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: 'Make Karna sound more desperate.' },
        { role: 'assistant', content: `<SCENE_SCRIPT>${mockHeavyScript}</SCENE_SCRIPT>\nDirect note: I have adjusted his tone.` },
        { role: 'user', content: 'Awesome! Now add a hidden armor touch.' },
        { role: 'assistant', content: `<SCENE_SCRIPT>${mockHeavyScript}\nHe touches the hidden armor.</SCENE_SCRIPT>\nDirect note: Added the armor detail.` },
        { role: 'user', content: 'Excellent work. Can you add Adhiratha snoring?' },
        { role: 'assistant', content: `<SCENE_SCRIPT>${mockHeavyScript}\nAdhiratha snores in the corner.</SCENE_SCRIPT>\nDirect note: Snoring added.` },
        { role: 'user', content: 'Perfect! Make the lamp flicker violently.' },
        { role: 'assistant', content: `<SCENE_SCRIPT>${mockHeavyScript}\nThe lamp flickers violently.</SCENE_SCRIPT>\nDirect note: Lamp is now flickering.` }
    ];

    const initialSize = entries.reduce((acc, curr) => acc + curr.content.length, 0);
    console.log(`Original History size: ${initialSize} characters (${entries.length} turns)`);

    // Invoke the private helper method directly via TypeScript 'any' cast
    const compressedResult = (scriptGenerator as any).buildAssistantChatHistoryText(entries);
    const compressedSize = compressedResult.length;
    console.log(`Compressed History size: ${compressedSize} characters`);

    console.log('\n--- VERIFYING ASSERIONS ---');
    
    // Assertion 1: Length reduction must be at least 80%
    const reductionRatio = (initialSize - compressedSize) / initialSize;
    console.log(`Token Footprint Reduction: ${(reductionRatio * 100).toFixed(2)}%`);
    if (reductionRatio < 0.80) {
        throw new Error(`Assertion Failed: Reduction ratio is only ${(reductionRatio * 100).toFixed(2)}%, expected >= 80%`);
    }
    console.log('✔ SUCCESS: Token footprint reduced by > 80%!');

    // Assertion 2: Lookback must be capped at 5 entries
    const turnsCount = (compressedResult.match(/\[USER\]:|\[ASSISTANT\]:/g) || []).length;
    console.log(`Extracted History Turns in Prompt: ${turnsCount}`);
    if (turnsCount > 5) {
        throw new Error(`Assertion Failed: Found ${turnsCount} turns in prompt, expected max 5 turns`);
    }
    console.log('✔ SUCCESS: Conversation lookback capped at max 5 turns!');

    // Assertion 3: No massive drafts remain in history
    if (compressedResult.includes('<SCENE_SCRIPT>')) {
        throw new Error('Assertion Failed: Found raw SCENE_SCRIPT tags in compressed text!');
    }
    console.log('✔ SUCCESS: Heavy screenplay draft blocks surgically pruned!');

    console.log('\n--- ALL COMPRESSION TESTS PASSED SUCCESSFULLY! ---');
}

try {
    runPromptCompressionTest();
} catch (err: any) {
    console.error('Test Failed with Error:', err.message);
    process.exit(1);
}
