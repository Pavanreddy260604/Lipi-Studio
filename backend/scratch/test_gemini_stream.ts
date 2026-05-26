import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log("Starting raw JSON stream test...");
    const apiKey = process.env.GEMINI_API_KEY || '';
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: 'Write a very short 1-sentence tagline for a sci-fi screenplay.' }]
            }
        ],
        generationConfig: {
            temperature: 0.7
        }
    };

    try {
        console.log("Requesting stream...");
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream'
        });

        const stream = response.data;
        let buffer = '';
        let count = 0;

        console.log("Awaiting stream data...");
        for await (const chunk of stream) {
            const chunkStr = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : '';
            buffer += chunkStr;

            let depth = 0;
            let startIdx = -1;
            for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] === '{') {
                    if (depth === 0) startIdx = i;
                    depth++;
                } else if (buffer[i] === '}') {
                    depth--;
                    if (depth === 0 && startIdx !== -1) {
                        const jsonStr = buffer.slice(startIdx, i + 1);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const candidate = parsed.candidates?.[0];
                            if (candidate) {
                                const parts = candidate.content?.parts || [];
                                for (const part of parts) {
                                    if (part.text) {
                                        console.log(`Yielded chunk ${++count}:`, JSON.stringify(part.text));
                                    }
                                }
                            }
                        } catch (e) {
                            // partial json
                        }
                        buffer = buffer.slice(i + 1);
                        i = -1; // Reset
                    }
                }
            }
        }
        console.log(`Stream finished. Total chunks yielded: ${count}`);
    } catch (err: any) {
        console.error("Streaming failed:", err.message);
    }
}

run();
