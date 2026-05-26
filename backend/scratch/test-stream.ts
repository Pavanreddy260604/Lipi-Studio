import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const proposeEditTool = {
    functionDeclarations: [{
        name: 'propose_edit',
        description: 'Propose screenplay script modifications or a full rewrite for the active scene. Use this tool whenever the user asks you to change, edit, rewrite, improve, add, or format the scene or dialogue. Do not output the screenplay script as conversational text, always call this function.',
        parameters: {
            type: 'OBJECT',
            properties: {
                revised_script: {
                    type: 'STRING',
                    description: 'The complete revised screenplay script content, or a surgical search/replace diff block.'
                },
                explanation: {
                    type: 'STRING',
                    description: 'A brief explanation explaining your script modifications (director\'s notes, craft rationale).'
                }
            },
            required: ['revised_script', 'explanation']
        }
    }]
};

async function run() {
    console.log("Starting RAW Gemini axios call...");
    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'gemini-2.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
    
    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: "Write a short scene. Please propose the revised script using the propose_edit tool." }]
            }
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            topP: 0.95,
            thinkingConfig: {
                thinkingBudget: -1, // dynamic
                includeThoughts: true
            }
        },
        tools: [
            { googleSearch: {} },
            proposeEditTool
        ]
    };
    
    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream'
        });
        console.log("Success! Stream received.");
    } catch (err: any) {
        console.error("AXIOS FAILED! Status:", err.response?.status);
        if (err.response?.data) {
            const data = err.response.data;
            if (typeof data.on === 'function') {
                const body = await new Promise<string>((resolve) => {
                    let res = '';
                    data.on('data', (chunk: any) => { res += chunk.toString(); });
                    data.on('end', () => resolve(res));
                    data.on('error', () => resolve(''));
                });
                console.error("RAW Error body from Gemini:", body);
            } else {
                console.error("RAW Error body from Gemini:", JSON.stringify(data, null, 2));
            }
        } else {
            console.error("No error response data. Message:", err.message);
        }
    }
}

run();
