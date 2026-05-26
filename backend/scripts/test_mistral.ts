import axios from 'axios';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
const MODEL = 'mistral-large-latest'; // Usually points to the latest Mistral Large 

async function testMistral() {
    console.log(`[Mistral Test] Starting test on model: ${MODEL}...`);
    
    const payload = {
        model: MODEL,
        messages: [{ role: 'user', content: 'Write a 2-sentence creative scene description about a futuristic city.' }],
        max_tokens: 50,
        temperature: 0.7
    };

    const startTime = Date.now();
    try {
        const response = await axios.post('https://api.mistral.ai/v1/chat/completions', payload, {
            headers: {
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        const duration = Date.now() - startTime;
        console.log(`\n✅ SUCCESS!`);
        console.log(`Time taken: ${duration}ms`);
        console.log(`Response: ${response.data.choices[0].message.content}`);
        
        // Print rate limit headers
        console.log('\n--- Rate Limit Headers ---');
        console.log(`Remaining Tokens:`, response.headers['x-ratelimit-remaining-tokens'] || 'N/A');
        console.log(`Remaining Requests:`, response.headers['x-ratelimit-remaining-requests'] || 'N/A');
        console.log(`Reset Time:`, response.headers['x-ratelimit-reset-requests'] || 'N/A');

    } catch (err: any) {
        console.error(`\n❌ FAILED!`);
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error(`Data:`, err.response.data);
            console.error('\n--- Rate Limit Headers ---');
            console.log(`Remaining Tokens:`, err.response.headers['x-ratelimit-remaining-tokens'] || 'N/A');
            console.log(`Remaining Requests:`, err.response.headers['x-ratelimit-remaining-requests'] || 'N/A');
            console.log(`Reset Time:`, err.response.headers['x-ratelimit-reset-requests'] || 'N/A');
        } else {
            console.error(err.message);
        }
    }
}

testMistral();
