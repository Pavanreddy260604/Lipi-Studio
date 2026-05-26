import { geminiService } from '../src/services/gemini.service';

async function run() {
    console.log("Testing live integrated geminiService.chatStream...");
    try {
        const stream = geminiService.chatStream(
            [{ role: 'user', content: 'Say hello in exactly three words.' }]
        );

        console.log("Reading yielded chunks from integrated service...");
        let fullText = '';
        let count = 0;
        for await (const chunk of stream) {
            console.log(`Chunk ${++count}:`, JSON.stringify(chunk));
            fullText += chunk;
        }
        console.log("\nFull stream result:", JSON.stringify(fullText));
        console.log("Stream successfully completed with", count, "chunks!");
    } catch (err: any) {
        console.error("Integrated chatStream test failed:", err.message);
    }
}

run();
