import dotenv from 'dotenv';
import path from 'path';
import { geminiService } from '../src/services/gemini/index.js';

dotenv.config();

async function run() {
    console.log("Starting Gemini API test with web search...");
    console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);
    
    try {
        const response = await geminiService.chat("What is the latest news about Google Gemini 2.5?", {
            model: 'thinking', // uses thinking profile
            reasoning_effort: 'default',
            reasoning_format: 'parsed',
            webSearch: true
        });
        console.log("SUCCESS! Response:", response);
    } catch (err: any) {
        console.error("FAILED! Error details:");
        console.error(err.message);
        if (err.stack) {
            console.error(err.stack);
        }
    }
}

run();
