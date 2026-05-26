import axios from 'axios';

async function run() {
    const apiKey = 'AIzaSyA9blTOLt8SNQRXnSdAul0_JUpJa8zuFM4';
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log(`Testing Gemini API Key with model: ${model}...`);
    try {
        const response = await axios.post(url, {
            contents: [
                {
                    parts: [
                        { text: "Say hello and write a 1-sentence description of why Gemini 2.5 Flash is excellent for screenwriters." }
                    ]
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("Success! Response from Gemini:");
        console.log(response.data.candidates[0].content.parts[0].text);
    } catch (err) {
        console.error("Failed to connect to Gemini API:", err.response?.data || err.message);
    }
}
run();
