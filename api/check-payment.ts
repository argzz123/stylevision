
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Настройки магазина
  const SHOP_ID = '1254700';
  const SECRET_KEY = 'live_knC5pIMu9fCBWGABTJOXCGtlrZdpGldHJAMrlT6xcsI';

  if (req.method !== 'POST') {
     return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

    // Node 16+ supports btoa
    const auth = btoa(`${SHOP_ID}:${SECRET_KEY}`);

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        throw new Error(`Yookassa API Error: ${response.status}`);
    }

    const data = await response.json();
    // Return the status (e.g., 'succeeded', 'canceled', 'pending')
    return res.status(200).json({ status: data.status, paid: data.paid });

  } catch (error: any) {
    console.error('Check Payment Error:', error);
    return res.status(500).json({ error: 'Check failed', details: error.message });
  }
}
