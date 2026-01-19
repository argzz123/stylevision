
export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Get Token from Environment
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is missing in environment variables");
    return res.status(500).json({ error: 'Bot token not configured on server' });
  }

  try {
    const { chatId, image, caption } = req.body;

    if (!chatId || !image) {
      return res.status(400).json({ error: 'Missing chatId or image' });
    }

    // 2. Convert Base64 to Blob/Buffer
    // Remove data:image/...;base64, prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    // Use standard Web API (atob + Uint8Array) instead of Node.js Buffer
    // to avoid TypeScript errors if @types/node is missing
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    // 3. Create FormData for Telegram API
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("photo", blob, "stylevision_look.png");
    if (caption) {
      formData.append("caption", caption);
    }

    // 4. Send to Telegram Bot API
    const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData
    });

    const result = await telegramRes.json();

    if (!result.ok) {
      console.error('Telegram API Error:', result);
      return res.status(500).json({ error: 'Failed to send photo to Telegram', details: result });
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Send Photo Handler Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
