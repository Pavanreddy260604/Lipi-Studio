import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'gemini-2.5-pro'; // The model used by 'thinking'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log(`Testing ENV Gemini API Key: ${apiKey?.slice(0, 10)}... with model: ${model}...`);
    try {
        const response = await axios.post(url, {
            contents: [
                {
                    parts: [
                        { text: "Say hello." }
                    ]
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("Success!");
        console.log(JSON.stringify(response.data?.candidates?.[0]?.content?.parts?.[0]?.text));
    } catch (err) {
        console.error("Failed:", err.response?.data || err.message);
    }
}
run();
