const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const stream = true;

const headers = {
  "Authorization": "Bearer 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",
  "Content-Type": "application/json",
  "Accept": stream ? "text/event-stream" : "application/json"
};

const payload = {
  "model": "mistralai/mistral-large-3-675b-instruct-2512",
  "messages": [{"role":"user","content":"why you so slow nvdia nim"}],
  "max_tokens": 100, // keep it small for quick test
  "temperature": 0.15,
  "top_p": 1.00,
  "frequency_penalty": 0.00,
  "presence_penalty": 0.00,
  "stream": stream
};

async function run() {
  console.log('Sending request to NVIDIA NIM API using native fetch...');
  try {
    const response = await fetch(invokeUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`HTTP Error: ${response.status} - ${response.statusText}`);
      console.error('Error Details:', errText);
      return;
    }

    if (stream) {
      console.log('Streaming response chunks:');
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('No readable stream found in response body');
        return;
      }
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(decoder.decode(value));
      }
    } else {
      const json = await response.json();
      console.log('Success! Response JSON:');
      console.log(JSON.stringify(json, null, 2));
    }
  } catch (err: any) {
    console.error('Request failed:', err.message);
  }
}

run();
