
export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { apiKey, model, data } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is missing in request body' });
    }

    // Use standard fetch (Node 18+) to call Google REST API directly
    // This avoids dependency issues with @google/genai SDK in the serverless environment
    // and ensures the request originates from Vercel's IP.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const googleResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error('Google API Error via Proxy:', errorText);
      try {
          const jsonErr = JSON.parse(errorText);
          return res.status(googleResponse.status).json(jsonErr);
      } catch (e) {
          return res.status(googleResponse.status).json({ error: errorText });
      }
    }

    const result = await googleResponse.json();
    return res.status(200).json(result);

  } catch (error) {
    console.error('Proxy Internal Error:', error);
    return res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
  }
}
