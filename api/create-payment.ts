
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Настройки магазина (из твоего server.js)
  const SHOP_ID = '1223028';
  const SECRET_KEY = 'test_epdm18C2SIOTlmED5m05Q-jXQDTsgJJK28m8JwdxlBM';

  if (req.method !== 'POST') {
     return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { amount, returnUrl, description } = req.body;
    const idempotenceKey = Math.random().toString(36).substring(7);
    
    // Replace Buffer with btoa for TypeScript compatibility without @types/node
    // Node.js 16+ supports global btoa
    const auth = btoa(`${SHOP_ID}:${SECRET_KEY}`);

    // Используем встроенный fetch (Node 18+)
    const backendRes = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: {
          value: amount || "1.00",
          currency: "RUB"
        },
        capture: true,
        confirmation: {
            type: "redirect",
            return_url: returnUrl
        },
        description: description || "Оплата StyleVision"
      })
    });

    if (!backendRes.ok) {
        const errorText = await backendRes.text();
        console.error('Yookassa Error:', errorText);
        try {
            const jsonErr = JSON.parse(errorText);
            return res.status(backendRes.status).json(jsonErr);
        } catch (e) {
            return res.status(backendRes.status).json({ error: errorText });
        }
    }

    const data = await backendRes.json();
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('API Handler Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
