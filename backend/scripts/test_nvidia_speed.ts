import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function testNvidiaSpeed() {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        console.error("❌ No NVIDIA_API_KEY found in .env");
        return;
    }

    console.log(`[NVIDIA Test] Starting speed test...`);
    
    // Testing the two most common standard models on NVIDIA NIM
    const modelsToTest = [
        'mistralai/mistral-large-2407', // Standard Mistral Large 2
        'meta/llama-3.1-70b-instruct'   // Reliable fallback
    ];

    for (const model of modelsToTest) {
        console.log(`\nTesting model: ${model}`);
        const payload = {
            model: model,
            messages: [{ role: 'user', content: 'Write a 1-sentence creative description of a cyberpunk city.' }],
            max_tokens: 50,
            temperature: 0.7
        };

        const startTime = Date.now();
        try {
            const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', payload, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000 // Force timeout if it hangs
            });
            
            const duration = Date.now() - startTime;
            console.log(`✅ SUCCESS! Time taken: ${duration}ms`);
            console.log(`Response: ${response.data.choices[0].message.content}`);
        } catch (err: any) {
            const duration = Date.now() - startTime;
            console.error(`❌ FAILED after ${duration}ms`);
            if (err.response) {
                console.error(`Status: ${err.response.status}`);
                console.error(`Data:`, err.response.data);
            } else {
                console.error(err.message);
            }
        }
    }
}

testNvidiaSpeed();
